package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import kotlin.test.assertEquals
import kotlin.test.assertNull

class UsageMeteringMigrationTest {
    @Test
    fun `V5 preserves legacy counts as feature units`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .target(MigrationVersion.fromVersion("4"))
                .load()
                .migrate()
            postgres.createConnection("").use(::insertLegacyUsage)

            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .load()
                .migrate()

            postgres.createConnection("").use { connection ->
                assertNull(tableName(connection, "daily_usage"))
                assertEquals(
                    listOf(
                        UsageRow("2026-07-24", "correction", 2),
                        UsageRow("2026-07-24", "ocr", 1),
                        UsageRow("2026-07-25", "correction", 0),
                        UsageRow("2026-07-25", "ocr", 0),
                    ),
                    usageRows(connection),
                )
                assertEquals(0, queryInt(connection, "SELECT count(*) FROM usage_reservations"))
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '5'
                          AND script = 'V5__generalize_usage_metering.sql'
                        """.trimIndent(),
                    ),
                )
            }
        } finally {
            postgres.stop()
        }
    }

    private fun insertLegacyUsage(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO users (id, display_name)
                VALUES (1001, 'Usage migration user')
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO daily_usage (
                    user_id, usage_date, correction_count, ocr_count, updated_at
                ) VALUES
                    (1001, '2026-07-24', 2, 1, '2026-07-24T12:00:00Z'),
                    (1001, '2026-07-25', 0, 0, '2026-07-25T12:00:00Z')
                """.trimIndent(),
            )
        }
    }

    private fun tableName(
        connection: Connection,
        table: String,
    ): String? =
        connection
            .prepareStatement("SELECT to_regclass(?)::text")
            .use { statement ->
                statement.setString(1, "public.$table")
                statement.executeQuery().use { resultSet ->
                    resultSet.next()
                    resultSet.getString(1)
                }
            }

    private fun usageRows(connection: Connection): List<UsageRow> =
        connection
            .createStatement()
            .use { statement ->
                statement.executeQuery(
                    """
                    SELECT usage_date::text, feature, units
                    FROM usage_counters
                    ORDER BY usage_date, feature
                    """.trimIndent(),
                ).use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(
                                UsageRow(
                                    usageDate = resultSet.getString(1),
                                    feature = resultSet.getString(2),
                                    units = resultSet.getLong(3),
                                ),
                            )
                        }
                    }
                }
            }

    private fun queryInt(
        connection: Connection,
        sql: String,
    ): Int =
        connection.createStatement().use { statement ->
            statement.executeQuery(sql).use { resultSet ->
                resultSet.next()
                resultSet.getInt(1)
            }
        }
}

private data class UsageRow(
    val usageDate: String,
    val feature: String,
    val units: Long,
)
