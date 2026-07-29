package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.preflight.ExistingDatabaseV3MigrationCommand
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ExistingDatabaseV3MigrationTest {
    @Test
    fun `guarded command migrates only a V2 database to V3`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            migrateTo(postgres, "2")

            assertFailsWith<IllegalArgumentException> {
                migrationCommand(postgres, confirmation = "WRONG").execute()
            }
            assertCurrentVersion(postgres, "2")

            assertFailsWith<IllegalArgumentException> {
                migrationCommand(postgres, expectedHost = "wrong.example.com").execute()
            }
            assertCurrentVersion(postgres, "2")

            val result = migrationCommand(postgres).execute()

            assertEquals("3", result.migrationVersion)
            assertCurrentVersion(postgres, "3")
            postgres.createConnection("").use { connection ->
                connection.createStatement().use { statement ->
                    statement
                        .executeQuery(
                            """
                            SELECT data_type
                            FROM information_schema.columns
                            WHERE table_schema = 'public'
                              AND table_name = 'users'
                              AND column_name = 'id'
                            """.trimIndent(),
                        ).use { resultSet ->
                            resultSet.next()
                            assertEquals("uuid", resultSet.getString(1))
                        }
                }
            }

            assertFailsWith<IllegalStateException> {
                migrationCommand(postgres).execute()
            }
            assertCurrentVersion(postgres, "3")
        } finally {
            postgres.stop()
        }
    }

    private fun migrateTo(
        postgres: PostgreSQLContainer,
        version: String,
    ) {
        Flyway
            .configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .target(MigrationVersion.fromVersion(version))
            .load()
            .migrate()
    }

    private fun migrationCommand(
        postgres: PostgreSQLContainer,
        confirmation: String = "MIGRATE_VERIFIED_DATABASE_TO_V3",
        expectedHost: String = java.net.URI(postgres.jdbcUrl.removePrefix("jdbc:")).host,
    ): ExistingDatabaseV3MigrationCommand =
        ExistingDatabaseV3MigrationCommand(
            url = postgres.jdbcUrl,
            username = postgres.username,
            password = postgres.password,
            confirmation = confirmation,
            expectedHost = expectedHost,
        )

    private fun assertCurrentVersion(
        postgres: PostgreSQLContainer,
        expected: String,
    ) {
        val currentVersion =
            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .load()
                .info()
                .current()
                ?.version
                ?.version
        assertEquals(expected, currentVersion)
    }
}
