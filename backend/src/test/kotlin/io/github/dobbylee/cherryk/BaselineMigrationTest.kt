package io.github.dobbylee.cherryk

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.junit.jupiter.Container
import org.testcontainers.junit.jupiter.Testcontainers
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@Testcontainers
@SpringBootTest
class BaselineMigrationTest(
    @Autowired private val jdbcClient: JdbcClient,
    @Autowired private val objectMapper: ObjectMapper,
) {
    companion object {
        @Container
        @JvmStatic
        val postgres = PostgreSQLContainer("postgres:18")

        @DynamicPropertySource
        @JvmStatic
        fun databaseProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }

    @Test
    fun `baseline recreates the final Drizzle schema`() {
        val applicationTables =
            jdbcClient
                .sql(
                    """
                    SELECT table_name
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_type = 'BASE TABLE'
                      AND table_name <> 'flyway_schema_history'
                    ORDER BY table_name
                    """.trimIndent(),
                ).query(String::class.java)
                .list()

        assertEquals(
            listOf(
                "accounts",
                "auth_sessions",
                "correction_mistakes",
                "corrections",
                "daily_usage",
                "quiz_attempts",
                "quiz_choices",
                "quiz_questions",
                "user_tag_stats",
                "users",
                "verifications",
            ),
            applicationTables,
        )
        assertFalse(applicationTables.contains("invite_codes"))
        assertFalse(applicationTables.contains("sessions"))

        val successfulBaselineCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM flyway_schema_history
                    WHERE success = true
                      AND script = 'B1__drizzle_baseline.sql'
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()

        assertEquals(1, successfulBaselineCount)
        assertTrue(columnIsNullable("corrections", "natural_text"))
        assertTrue(columnIsNullable("quiz_attempts", "selected_choice_id"))
    }

    @Test
    fun `baseline columns constraints and indexes match the final Drizzle snapshot`() {
        val snapshotResource =
            requireNotNull(javaClass.classLoader.getResource("0007_snapshot.json")) {
                "Final Drizzle schema snapshot is missing."
            }
        val snapshot =
            snapshotResource.openStream().use { input ->
                objectMapper.readValue<DrizzleSnapshot>(input)
            }

        snapshot.tables.values.forEach { table ->
            val actualColumns =
                jdbcClient
                    .sql(
                        """
                        SELECT column_name, data_type, is_nullable = 'NO'
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = :table
                        ORDER BY ordinal_position
                        """.trimIndent(),
                    ).param("table", table.name)
                    .query { resultSet, _ ->
                        DrizzleColumn(
                            name = resultSet.getString("column_name"),
                            type = resultSet.getString("data_type"),
                            notNull = resultSet.getBoolean(3),
                        )
                    }.list()

            assertEquals(
                table.columns.values.toList(),
                actualColumns,
                "Column drift in ${table.name}",
            )

            val actualConstraintNames =
                jdbcClient
                    .sql(
                        """
                        SELECT conname
                        FROM pg_constraint
                        WHERE conrelid = ('public.' || :table)::regclass
                        """.trimIndent(),
                    ).param("table", table.name)
                    .query(String::class.java)
                    .list()
                    .toSet()
            val expectedConstraintNames =
                table.foreignKeys.keys +
                    table.uniqueConstraints.keys +
                    table.compositePrimaryKeys.keys
            assertTrue(
                actualConstraintNames.containsAll(expectedConstraintNames),
                "Constraint drift in ${table.name}: expected $expectedConstraintNames, actual $actualConstraintNames",
            )

            val actualIndexNames =
                jdbcClient
                    .sql(
                        """
                        SELECT indexname
                        FROM pg_indexes
                        WHERE schemaname = 'public'
                          AND tablename = :table
                        """.trimIndent(),
                    ).param("table", table.name)
                    .query(String::class.java)
                    .list()
                    .toSet()
            assertTrue(
                actualIndexNames.containsAll(table.indexes.keys),
                "Index drift in ${table.name}: expected ${table.indexes.keys}, actual $actualIndexNames",
            )
        }
    }

    private fun columnIsNullable(
        table: String,
        column: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                SELECT is_nullable = 'YES'
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :table
                  AND column_name = :column
                """.trimIndent(),
            ).param("table", table)
            .param("column", column)
            .query(Boolean::class.java)
            .single()
}

private data class DrizzleSnapshot(
    val tables: Map<String, DrizzleTable>,
)

private data class DrizzleTable(
    val name: String,
    val columns: Map<String, DrizzleColumn>,
    val indexes: Map<String, Any>,
    val foreignKeys: Map<String, Any>,
    val compositePrimaryKeys: Map<String, Any>,
    val uniqueConstraints: Map<String, Any>,
)

private data class DrizzleColumn(
    val name: String,
    val type: String,
    val notNull: Boolean,
)
