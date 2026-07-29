package io.github.dobbylee.cherryk.preflight

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import java.sql.Connection
import java.sql.DriverManager

fun main() {
    val result =
        PreV4MigrationPreflight.run(
            url = preV4Environment("SCHEMA_PREFLIGHT_DATABASE_URL"),
            username = preV4Environment("SCHEMA_PREFLIGHT_DATABASE_USERNAME"),
            password = preV4Environment("SCHEMA_PREFLIGHT_DATABASE_PASSWORD"),
        )

    println("Flyway version ${result.flywayVersion} is validated.")
    println("V4 UUID columns and relationships are ready.")
}

object PreV4MigrationPreflight {
    fun run(
        url: String,
        username: String,
        password: String,
    ): PreV4MigrationPreflightResult {
        require(url.startsWith("jdbc:postgresql://")) {
            "SCHEMA_PREFLIGHT_DATABASE_URL must be a PostgreSQL JDBC URL."
        }

        val flyway =
            Flyway
                .configure()
                .dataSource(url, username, password)
                .defaultSchema("public")
                .schemas("public")
                .target(MigrationVersion.fromVersion("3"))
                .load()
        val currentVersion = flyway.info().current()?.version?.version
        check(currentVersion == "3") {
            "Expected current Flyway version 3 before the V4 preflight, got ${currentVersion ?: "none"}."
        }
        val validation = flyway.validateWithResult()
        check(validation.validationSuccessful) {
            validation.invalidMigrations.joinToString(
                prefix = "Flyway validation failed:\n- ",
                separator = "\n- ",
            )
        }

        DriverManager.getConnection(url, username, password).use { connection ->
            connection.autoCommit = false
            connection.isReadOnly = true
            try {
                val currentSchema =
                    connection.createStatement().use { statement ->
                        statement.executeQuery("SELECT current_schema()").use { resultSet ->
                            resultSet.next()
                            resultSet.getString(1)
                        }
                    }
                check(currentSchema == "public") {
                    "The target connection must use the public schema."
                }

                val report = verify(connection)
                check(report.unexpectedUuidColumns.isEmpty()) {
                    report.unexpectedUuidColumns.joinToString(
                        prefix = "V4 UUID column readiness failed:\n- ",
                        separator = "\n- ",
                    )
                }
                check(report.relationshipViolations.isEmpty()) {
                    report.relationshipViolations.joinToString(
                        prefix = "V4 relationship readiness failed:\n- ",
                        separator = "\n- ",
                    )
                }
            } finally {
                connection.rollback()
            }
        }

        return PreV4MigrationPreflightResult(flywayVersion = currentVersion)
    }

    fun verify(connection: Connection): PreV4MigrationPreflightReport =
        PreV4MigrationPreflightReport(
            unexpectedUuidColumns = readUnexpectedUuidColumns(connection),
            relationshipViolations = readRelationshipViolations(connection),
        )

    private fun readUnexpectedUuidColumns(connection: Connection): List<String> =
        connection
            .prepareStatement(
                """
                SELECT data_type
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = ?
                  AND column_name = ?
                """.trimIndent(),
            ).use { statement ->
                expectedUuidColumns.mapNotNull { column ->
                    statement.setString(1, column.table)
                    statement.setString(2, column.column)
                    statement.executeQuery().use { resultSet ->
                        val actualType =
                            if (resultSet.next()) {
                                resultSet.getString("data_type")
                            } else {
                                "missing"
                            }
                        if (actualType == "uuid") {
                            null
                        } else {
                            "${column.table}.${column.column} expected uuid, got $actualType"
                        }
                    }
                }
            }

    private fun readRelationshipViolations(connection: Connection): List<String> =
        buildList {
            relationshipChecks.forEach { check ->
                connection.createStatement().use { statement ->
                    statement.executeQuery(check.sql).use { resultSet ->
                        resultSet.next()
                        val nullCount = resultSet.getLong("null_count")
                        val orphanCount = resultSet.getLong("orphan_count")
                        if (!check.nullable && nullCount > 0) {
                            add("${check.name} has $nullCount null values")
                        }
                        if (orphanCount > 0) {
                            add("${check.name} has $orphanCount orphaned values")
                        }
                    }
                }
            }
        }
}

data class PreV4MigrationPreflightResult(
    val flywayVersion: String,
)

data class PreV4MigrationPreflightReport(
    val unexpectedUuidColumns: List<String>,
    val relationshipViolations: List<String>,
)

private data class ColumnReference(
    val table: String,
    val column: String,
)

private data class RelationshipCheck(
    val name: String,
    val nullable: Boolean = false,
    val sql: String,
)

private val expectedUuidColumns =
    listOf(
        ColumnReference("users", "id"),
        ColumnReference("accounts", "id"),
        ColumnReference("accounts", "user_id"),
        ColumnReference("auth_sessions", "id"),
        ColumnReference("auth_sessions", "user_id"),
        ColumnReference("verifications", "id"),
        ColumnReference("daily_usage", "user_id"),
        ColumnReference("corrections", "id"),
        ColumnReference("corrections", "user_id"),
        ColumnReference("correction_mistakes", "id"),
        ColumnReference("correction_mistakes", "correction_id"),
        ColumnReference("user_tag_stats", "user_id"),
        ColumnReference("quiz_questions", "id"),
        ColumnReference("quiz_questions", "supersedes_quiz_id"),
        ColumnReference("quiz_choices", "id"),
        ColumnReference("quiz_choices", "quiz_question_id"),
        ColumnReference("quiz_attempts", "id"),
        ColumnReference("quiz_attempts", "user_id"),
        ColumnReference("quiz_attempts", "quiz_question_id"),
        ColumnReference("quiz_attempts", "selected_choice_id"),
        ColumnReference("user_identities", "id"),
        ColumnReference("user_identities", "user_id"),
    )

private val relationshipChecks =
    listOf(
        requiredRelationship("accounts.user_id -> users.id", "accounts", "user_id", "users"),
        requiredRelationship("auth_sessions.user_id -> users.id", "auth_sessions", "user_id", "users"),
        requiredRelationship("daily_usage.user_id -> users.id", "daily_usage", "user_id", "users"),
        requiredRelationship("corrections.user_id -> users.id", "corrections", "user_id", "users"),
        requiredRelationship("user_tag_stats.user_id -> users.id", "user_tag_stats", "user_id", "users"),
        requiredRelationship("user_identities.user_id -> users.id", "user_identities", "user_id", "users"),
        requiredRelationship(
            "correction_mistakes.correction_id -> corrections.id",
            "correction_mistakes",
            "correction_id",
            "corrections",
        ),
        optionalRelationship(
            "quiz_questions.supersedes_quiz_id -> quiz_questions.id",
            "quiz_questions",
            "supersedes_quiz_id",
            "quiz_questions",
        ),
        requiredRelationship(
            "quiz_choices.quiz_question_id -> quiz_questions.id",
            "quiz_choices",
            "quiz_question_id",
            "quiz_questions",
        ),
        requiredRelationship(
            "quiz_attempts.user_id -> users.id",
            "quiz_attempts",
            "user_id",
            "users",
        ),
        requiredRelationship(
            "quiz_attempts.quiz_question_id -> quiz_questions.id",
            "quiz_attempts",
            "quiz_question_id",
            "quiz_questions",
        ),
        RelationshipCheck(
            name = "quiz_attempts selected choice ownership",
            sql =
                """
                SELECT
                    count(*) FILTER (WHERE attempt.selected_choice_id IS NULL) AS null_count,
                    count(*) FILTER (
                        WHERE attempt.selected_choice_id IS NOT NULL
                          AND choice.id IS NULL
                    ) AS orphan_count
                FROM quiz_attempts attempt
                LEFT JOIN quiz_choices choice
                  ON choice.quiz_question_id = attempt.quiz_question_id
                 AND choice.id = attempt.selected_choice_id
                """.trimIndent(),
        ),
    )

private fun requiredRelationship(
    name: String,
    childTable: String,
    childColumn: String,
    parentTable: String,
): RelationshipCheck =
    relationshipCheck(
        name = name,
        childTable = childTable,
        childColumn = childColumn,
        parentTable = parentTable,
        nullable = false,
    )

private fun optionalRelationship(
    name: String,
    childTable: String,
    childColumn: String,
    parentTable: String,
): RelationshipCheck =
    relationshipCheck(
        name = name,
        childTable = childTable,
        childColumn = childColumn,
        parentTable = parentTable,
        nullable = true,
    )

private fun relationshipCheck(
    name: String,
    childTable: String,
    childColumn: String,
    parentTable: String,
    nullable: Boolean,
): RelationshipCheck {
    require(listOf(childTable, childColumn, parentTable).all { it.matches(Regex("[a-z_]+")) })
    return RelationshipCheck(
        name = name,
        nullable = nullable,
        sql =
            """
            SELECT
                count(*) FILTER (WHERE child.$childColumn IS NULL) AS null_count,
                count(*) FILTER (
                    WHERE child.$childColumn IS NOT NULL
                      AND parent.id IS NULL
                ) AS orphan_count
            FROM $childTable child
            LEFT JOIN $parentTable parent ON parent.id = child.$childColumn
            """.trimIndent(),
    )
}

private fun preV4Environment(name: String): String =
    requireNotNull(System.getenv(name)?.takeIf(String::isNotBlank)) {
        "$name is required."
    }
