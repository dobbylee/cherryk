package io.github.dobbylee.cherryk.preflight

import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import java.sql.Connection
import java.sql.DriverManager

fun main() {
    val url = requiredEnvironment("SCHEMA_PREFLIGHT_DATABASE_URL")
    require(url.startsWith("jdbc:postgresql://")) {
        "SCHEMA_PREFLIGHT_DATABASE_URL must be a PostgreSQL JDBC URL."
    }
    DriverManager
        .getConnection(
            url,
            requiredEnvironment("SCHEMA_PREFLIGHT_DATABASE_USERNAME"),
            requiredEnvironment("SCHEMA_PREFLIGHT_DATABASE_PASSWORD"),
        ).use { connection ->
            connection.autoCommit = false
            connection.isReadOnly = true
            try {
                val report = SchemaPreflight.verify(connection)
                check(report.schemaErrors.isEmpty()) {
                    report.schemaErrors.joinToString(
                        prefix = "Schema does not match the frozen Drizzle baseline:\n- ",
                        separator = "\n- ",
                    )
                }
                check(report.quizReadiness.totalViolations == 0L) {
                    "Quiz lifecycle constraints are not ready: ${report.quizReadiness}"
                }
                println("Schema matches the frozen Drizzle baseline.")
                println("Quiz lifecycle data is ready for the planned constraints.")
            } finally {
                connection.rollback()
            }
        }
}

private fun requiredEnvironment(name: String): String =
    requireNotNull(System.getenv(name)?.takeIf(String::isNotBlank)) {
        "$name is required."
    }

object SchemaPreflight {
    fun verify(connection: Connection): SchemaPreflightReport {
        val snapshot = loadSnapshot()
        val errors = mutableListOf<String>()
        val actualTables =
            connection
                .prepareStatement(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_type = 'BASE TABLE'
                      AND table_name <> 'flyway_schema_history'
                    ORDER BY table_name
                    """.trimIndent(),
                ).use { statement ->
                    statement.executeQuery().use { resultSet ->
                        buildList {
                            while (resultSet.next()) {
                                add(resultSet.getString("table_name"))
                            }
                        }
                    }
                }
        val expectedTables = snapshot.tables.values.map(DrizzleTable::name).sorted()
        if (actualTables != expectedTables) {
            errors += "Table drift: expected $expectedTables, actual $actualTables"
        }

        snapshot.tables.values.forEach { table ->
            verifyTable(connection, table, errors)
        }

        return SchemaPreflightReport(
            schemaErrors = errors,
            quizReadiness = readQuizReadiness(connection),
        )
    }

    private fun verifyTable(
        connection: Connection,
        table: DrizzleTable,
        errors: MutableList<String>,
    ) {
        val actualColumns =
            connection
                .prepareStatement(
                    """
                    SELECT
                        columns.column_name,
                        columns.data_type,
                        columns.is_nullable = 'NO',
                        columns.column_default,
                        EXISTS (
                            SELECT 1
                            FROM pg_constraint constraint_definition
                            INNER JOIN pg_attribute attribute
                              ON attribute.attrelid = constraint_definition.conrelid
                             AND attribute.attnum = ANY (constraint_definition.conkey)
                            WHERE constraint_definition.conrelid =
                                  ('public.' || columns.table_name)::regclass
                              AND constraint_definition.contype = 'p'
                              AND cardinality(constraint_definition.conkey) = 1
                              AND attribute.attname = columns.column_name
                        ) AS is_single_primary_key
                    FROM information_schema.columns columns
                    WHERE columns.table_schema = 'public'
                      AND columns.table_name = ?
                    ORDER BY columns.ordinal_position
                    """.trimIndent(),
                ).use { statement ->
                    statement.setString(1, table.name)
                    statement.executeQuery().use { resultSet ->
                        buildList {
                            while (resultSet.next()) {
                                add(
                                    DrizzleColumn(
                                        name = resultSet.getString("column_name"),
                                        type = resultSet.getString("data_type"),
                                        notNull = resultSet.getBoolean(3),
                                        primaryKey = resultSet.getBoolean("is_single_primary_key"),
                                        default = normalizeDefault(resultSet.getString("column_default")),
                                    ),
                                )
                            }
                        }
                    }
                }.associateBy(DrizzleColumn::name)
        val expectedColumns = table.columns.values.associateBy(DrizzleColumn::name)
        if (actualColumns != expectedColumns) {
            errors += "Column drift in ${table.name}: expected $expectedColumns, actual $actualColumns"
        }

        val actualConstraints = readConstraints(connection, table.name)
        val expectedConstraints = expectedConstraints(table)
        if (actualConstraints != expectedConstraints) {
            errors +=
                "Constraint drift in ${table.name}: expected $expectedConstraints, actual $actualConstraints"
        }

        val actualIndexes = readIndexes(connection, table.name)
        val expectedIndexes = expectedIndexes(table)
        if (actualIndexes != expectedIndexes) {
            errors +=
                "Index drift in ${table.name}: expected $expectedIndexes, actual $actualIndexes"
        }
    }

    private fun readConstraints(
        connection: Connection,
        table: String,
    ): Map<String, ConstraintSignature> =
        connection
            .prepareStatement(
                """
                SELECT
                    constraint_definition.conname,
                    constraint_definition.contype,
                    ARRAY(
                        SELECT attribute.attname
                        FROM unnest(constraint_definition.conkey) WITH ORDINALITY key(attnum, position)
                        INNER JOIN pg_attribute attribute
                          ON attribute.attrelid = constraint_definition.conrelid
                         AND attribute.attnum = key.attnum
                        ORDER BY key.position
                    ) AS columns,
                    referenced_table.relname AS referenced_table,
                    ARRAY(
                        SELECT attribute.attname
                        FROM unnest(constraint_definition.confkey) WITH ORDINALITY key(attnum, position)
                        INNER JOIN pg_attribute attribute
                          ON attribute.attrelid = constraint_definition.confrelid
                         AND attribute.attnum = key.attnum
                        ORDER BY key.position
                    ) AS referenced_columns,
                    referenced_namespace.nspname AS referenced_schema,
                    constraint_definition.confdeltype,
                    constraint_definition.confupdtype,
                    constraint_definition.convalidated,
                    constraint_definition.condeferrable,
                    constraint_definition.condeferred,
                    COALESCE(constraint_index.indnullsnotdistinct, false)
                        AS nulls_not_distinct
                FROM pg_constraint constraint_definition
                LEFT JOIN pg_class referenced_table
                  ON referenced_table.oid = constraint_definition.confrelid
                LEFT JOIN pg_namespace referenced_namespace
                  ON referenced_namespace.oid = referenced_table.relnamespace
                LEFT JOIN pg_index constraint_index
                  ON constraint_index.indexrelid = constraint_definition.conindid
                WHERE constraint_definition.conrelid = ('public.' || ?)::regclass
                  AND constraint_definition.contype <> 'n'
                ORDER BY constraint_definition.conname
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, table)
                statement.executeQuery().use { resultSet ->
                    buildMap {
                        while (resultSet.next()) {
                            put(
                                resultSet.getString("conname"),
                                ConstraintSignature(
                                    type = constraintType(resultSet.getString("contype")),
                                    columns = resultSet.stringList("columns"),
                                    referencedSchema = resultSet.getString("referenced_schema"),
                                    referencedTable = resultSet.getString("referenced_table"),
                                    referencedColumns = resultSet.stringList("referenced_columns"),
                                    onDelete = referenceAction(resultSet.getString("confdeltype")),
                                    onUpdate = referenceAction(resultSet.getString("confupdtype")),
                                    nullsNotDistinct = resultSet.getBoolean("nulls_not_distinct"),
                                    validated = resultSet.getBoolean("convalidated"),
                                    deferrable = resultSet.getBoolean("condeferrable"),
                                    initiallyDeferred = resultSet.getBoolean("condeferred"),
                                ),
                            )
                        }
                    }
                }
            }

    private fun expectedConstraints(table: DrizzleTable): Map<String, ConstraintSignature> =
        buildMap {
            table.columns.values
                .filter(DrizzleColumn::primaryKey)
                .takeIf(List<DrizzleColumn>::isNotEmpty)
                ?.let { primaryKeyColumns ->
                    put(
                        "${table.name}_pkey",
                        ConstraintSignature(
                            type = ConstraintType.PRIMARY_KEY,
                            columns = primaryKeyColumns.map(DrizzleColumn::name),
                        ),
                    )
                }
            table.compositePrimaryKeys.values.forEach { primaryKey ->
                put(
                    primaryKey.name,
                    ConstraintSignature(
                        type = ConstraintType.PRIMARY_KEY,
                        columns = primaryKey.columns,
                    ),
                )
            }
            table.uniqueConstraints.values.forEach { uniqueConstraint ->
                put(
                    uniqueConstraint.name,
                    ConstraintSignature(
                        type = ConstraintType.UNIQUE,
                        columns = uniqueConstraint.columns,
                        nullsNotDistinct = uniqueConstraint.nullsNotDistinct,
                    ),
                )
            }
            table.foreignKeys.values.forEach { foreignKey ->
                put(
                    foreignKey.name,
                    ConstraintSignature(
                        type = ConstraintType.FOREIGN_KEY,
                        columns = foreignKey.columnsFrom,
                        referencedSchema = "public",
                        referencedTable = foreignKey.tableTo,
                        referencedColumns = foreignKey.columnsTo,
                        onDelete = foreignKey.onDelete,
                        onUpdate = foreignKey.onUpdate,
                    ),
                )
            }
        }

    private fun readIndexes(
        connection: Connection,
        table: String,
    ): Map<String, IndexSignature> =
        connection
            .prepareStatement(
                """
                SELECT
                    index_relation.relname AS index_name,
                    access_method.amname AS method,
                    index_definition.indisunique,
                    index_definition.indisvalid,
                    index_definition.indisready,
                    index_definition.indnullsnotdistinct,
                    ARRAY(
                        SELECT pg_get_indexdef(
                            index_definition.indexrelid,
                            position,
                            true
                        )
                        FROM generate_series(1, index_definition.indnkeyatts) position
                        ORDER BY position
                    ) AS columns,
                    ARRAY(
                        SELECT pg_get_indexdef(
                            index_definition.indexrelid,
                            position,
                            true
                        )
                        FROM generate_series(
                            index_definition.indnkeyatts + 1,
                            index_definition.indnatts
                        ) position
                        ORDER BY position
                    ) AS included_columns,
                    pg_get_expr(index_definition.indpred, index_definition.indrelid)
                        AS predicate,
                    index_relation.reloptions
                FROM pg_index index_definition
                INNER JOIN pg_class table_relation
                  ON table_relation.oid = index_definition.indrelid
                INNER JOIN pg_namespace table_namespace
                  ON table_namespace.oid = table_relation.relnamespace
                INNER JOIN pg_class index_relation
                  ON index_relation.oid = index_definition.indexrelid
                INNER JOIN pg_am access_method
                  ON access_method.oid = index_relation.relam
                LEFT JOIN pg_constraint backing_constraint
                  ON backing_constraint.conindid = index_definition.indexrelid
                WHERE table_namespace.nspname = 'public'
                  AND table_relation.relname = ?
                  AND backing_constraint.oid IS NULL
                ORDER BY index_relation.relname
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, table)
                statement.executeQuery().use { resultSet ->
                    buildMap {
                        while (resultSet.next()) {
                            put(
                                resultSet.getString("index_name"),
                                IndexSignature(
                                    method = resultSet.getString("method"),
                                    unique = resultSet.getBoolean("indisunique"),
                                    valid = resultSet.getBoolean("indisvalid"),
                                    ready = resultSet.getBoolean("indisready"),
                                    nullsNotDistinct =
                                        resultSet.getBoolean("indnullsnotdistinct"),
                                    columns = resultSet.stringList("columns").map(::normalizeIndexColumn),
                                    includedColumns =
                                        resultSet
                                            .stringList("included_columns")
                                            .map(::normalizeIndexColumn),
                                    predicate =
                                        resultSet
                                            .getString("predicate")
                                            ?.let(::normalizeIndexColumn),
                                    options = resultSet.stringList("reloptions").sorted(),
                                ),
                            )
                        }
                    }
                }
            }

    private fun expectedIndexes(table: DrizzleTable): Map<String, IndexSignature> =
        table.indexes.values.associate { index ->
            index.name to
                IndexSignature(
                    method = index.method,
                    unique = index.isUnique,
                    valid = true,
                    ready = true,
                    nullsNotDistinct = false,
                    columns =
                        index.columns.map { column ->
                            buildString {
                                append(column.expression)
                                if (!column.asc) {
                                    append(" DESC")
                                }
                                val defaultNulls = if (column.asc) "last" else "first"
                                if (column.nulls != defaultNulls) {
                                    append(" NULLS ${column.nulls.uppercase()}")
                                }
                            }
                        },
                    options =
                        index.with
                            .map { (name, value) -> "$name=$value" }
                            .sorted(),
                )
        }

    private fun normalizeIndexColumn(value: String): String =
        value
            .replace("\"", "")
            .replace(Regex("\\s+"), " ")
            .trim()

    private fun constraintType(value: String): ConstraintType =
        when (value) {
            "p" -> ConstraintType.PRIMARY_KEY
            "u" -> ConstraintType.UNIQUE
            "f" -> ConstraintType.FOREIGN_KEY
            "c" -> ConstraintType.CHECK
            else -> error("Unsupported PostgreSQL constraint type: $value")
        }

    private fun referenceAction(value: String): String? =
        when (value) {
            "a" -> "no action"
            "r" -> "restrict"
            "c" -> "cascade"
            "n" -> "set null"
            "d" -> "set default"
            " " -> null
            else -> null
        }

    private fun java.sql.ResultSet.stringList(column: String): List<String> =
        getArray(column)
            ?.array
            ?.let { values -> (values as Array<*>).map(Any?::toString) }
            .orEmpty()

    private fun readQuizReadiness(connection: Connection): QuizLifecycleReadiness =
        connection
            .prepareStatement(
                """
                SELECT
                    (SELECT count(*) FROM quiz_attempts WHERE selected_choice_id IS NULL)
                        AS null_selected_choices,
                    (
                        SELECT count(*)
                        FROM quiz_attempts a
                        LEFT JOIN quiz_choices c
                          ON c.id = a.selected_choice_id
                         AND c.quiz_question_id = a.quiz_question_id
                        WHERE a.selected_choice_id IS NOT NULL
                          AND c.id IS NULL
                    ) AS invalid_choice_ownership,
                    (
                        SELECT count(*)
                        FROM (
                            SELECT q.id
                            FROM quiz_questions q
                            LEFT JOIN quiz_choices c ON c.quiz_question_id = q.id
                            GROUP BY q.id
                            HAVING count(c.id) <> 4
                        ) invalid_choice_count
                    ) AS quizzes_without_four_choices,
                    (
                        SELECT count(*)
                        FROM (
                            SELECT q.id
                            FROM quiz_questions q
                            LEFT JOIN quiz_choices c ON c.quiz_question_id = q.id
                            WHERE q.status = 'approved'
                            GROUP BY q.id
                            HAVING count(c.id) FILTER (WHERE c.is_correct) <> 1
                        ) invalid_correct_count
                    ) AS approved_without_one_answer,
                    (
                        SELECT count(*)
                        FROM (
                            SELECT quiz_question_id
                            FROM quiz_choices
                            GROUP BY quiz_question_id
                            HAVING count(*) <> count(DISTINCT sort_order)
                        ) duplicate_sort_order
                    ) AS quizzes_with_duplicate_sort_order,
                    (
                        SELECT count(*)
                        FROM quiz_choices
                        WHERE sort_order NOT BETWEEN 0 AND 3
                    ) AS choices_with_out_of_range_sort_order,
                    (
                        SELECT count(*)
                        FROM quiz_questions
                        WHERE status NOT IN ('draft', 'approved', 'retired')
                    ) AS quizzes_with_unsupported_status,
                    (
                        SELECT count(*)
                        FROM quiz_questions
                        WHERE difficulty NOT IN (
                            'beginner',
                            'lower_intermediate',
                            'intermediate'
                        )
                    ) AS quizzes_with_unsupported_difficulty,
                    (
                        SELECT count(*)
                        FROM (
                            SELECT quiz_question_id
                            FROM quiz_choices
                            GROUP BY quiz_question_id
                            HAVING count(*) FILTER (WHERE is_correct) > 1
                        ) multiple_correct_choices
                    ) AS quizzes_with_multiple_correct_choices
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    check(resultSet.next())
                    QuizLifecycleReadiness(
                        nullSelectedChoices = resultSet.getLong("null_selected_choices"),
                        invalidChoiceOwnership = resultSet.getLong("invalid_choice_ownership"),
                        quizzesWithoutFourChoices = resultSet.getLong("quizzes_without_four_choices"),
                        approvedWithoutOneAnswer = resultSet.getLong("approved_without_one_answer"),
                        quizzesWithDuplicateSortOrder =
                            resultSet.getLong("quizzes_with_duplicate_sort_order"),
                        choicesWithOutOfRangeSortOrder =
                            resultSet.getLong("choices_with_out_of_range_sort_order"),
                        quizzesWithUnsupportedStatus =
                            resultSet.getLong("quizzes_with_unsupported_status"),
                        quizzesWithUnsupportedDifficulty =
                            resultSet.getLong("quizzes_with_unsupported_difficulty"),
                        quizzesWithMultipleCorrectChoices =
                            resultSet.getLong("quizzes_with_multiple_correct_choices"),
                    )
                }
            }

    private fun normalizeDefault(value: String?): String? =
        value?.replace(Regex("::[a-zA-Z ]+(?:\\[\\])?"), "")

    private fun loadSnapshot(): DrizzleSnapshot {
        val resource =
            requireNotNull(SchemaPreflight::class.java.classLoader.getResource("0007_snapshot.json")) {
                "Final Drizzle schema snapshot is missing."
            }
        return resource.openStream().use { input ->
            jacksonObjectMapper().readValue<DrizzleSnapshot>(input)
        }
    }
}

data class SchemaPreflightReport(
    val schemaErrors: List<String>,
    val quizReadiness: QuizLifecycleReadiness,
)

data class QuizLifecycleReadiness(
    val nullSelectedChoices: Long,
    val invalidChoiceOwnership: Long,
    val quizzesWithoutFourChoices: Long,
    val approvedWithoutOneAnswer: Long,
    val quizzesWithDuplicateSortOrder: Long,
    val choicesWithOutOfRangeSortOrder: Long,
    val quizzesWithUnsupportedStatus: Long,
    val quizzesWithUnsupportedDifficulty: Long,
    val quizzesWithMultipleCorrectChoices: Long,
) {
    val totalViolations: Long
        get() =
            nullSelectedChoices +
                invalidChoiceOwnership +
                quizzesWithoutFourChoices +
                approvedWithoutOneAnswer +
                quizzesWithDuplicateSortOrder +
                choicesWithOutOfRangeSortOrder +
                quizzesWithUnsupportedStatus +
                quizzesWithUnsupportedDifficulty +
                quizzesWithMultipleCorrectChoices
}

private enum class ConstraintType {
    PRIMARY_KEY,
    UNIQUE,
    FOREIGN_KEY,
    CHECK,
}

private data class ConstraintSignature(
    val type: ConstraintType,
    val columns: List<String>,
    val referencedSchema: String? = null,
    val referencedTable: String? = null,
    val referencedColumns: List<String> = emptyList(),
    val onDelete: String? = null,
    val onUpdate: String? = null,
    val nullsNotDistinct: Boolean = false,
    val validated: Boolean = true,
    val deferrable: Boolean = false,
    val initiallyDeferred: Boolean = false,
)

private data class IndexSignature(
    val method: String,
    val unique: Boolean,
    val valid: Boolean,
    val ready: Boolean,
    val nullsNotDistinct: Boolean,
    val columns: List<String>,
    val includedColumns: List<String> = emptyList(),
    val predicate: String? = null,
    val options: List<String> = emptyList(),
)

private data class DrizzleSnapshot(
    val tables: Map<String, DrizzleTable>,
)

private data class DrizzleTable(
    val name: String,
    val columns: Map<String, DrizzleColumn>,
    val indexes: Map<String, DrizzleIndex>,
    val foreignKeys: Map<String, DrizzleForeignKey>,
    val compositePrimaryKeys: Map<String, DrizzleCompositePrimaryKey>,
    val uniqueConstraints: Map<String, DrizzleUniqueConstraint>,
)

private data class DrizzleColumn(
    val name: String,
    val type: String,
    val notNull: Boolean,
    val primaryKey: Boolean,
    val default: String? = null,
)

private data class DrizzleIndex(
    val name: String,
    val columns: List<DrizzleIndexColumn>,
    val isUnique: Boolean,
    val method: String,
    val with: Map<String, String> = emptyMap(),
)

private data class DrizzleIndexColumn(
    val expression: String,
    val isExpression: Boolean,
    val asc: Boolean,
    val nulls: String,
)

private data class DrizzleForeignKey(
    val name: String,
    val tableTo: String,
    val columnsFrom: List<String>,
    val columnsTo: List<String>,
    val onDelete: String,
    val onUpdate: String,
)

private data class DrizzleCompositePrimaryKey(
    val name: String,
    val columns: List<String>,
)

private data class DrizzleUniqueConstraint(
    val name: String,
    val nullsNotDistinct: Boolean,
    val columns: List<String>,
)
