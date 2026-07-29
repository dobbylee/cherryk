package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.preflight.PreV4MigrationPreflight
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class PreV4MigrationPreflightTest {
    @Test
    fun `preflight accepts V3 and reports relationship drift before V4`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            migrateTo(postgres, "2")
            assertFailsWith<IllegalStateException> {
                PreV4MigrationPreflight.run(
                    postgres.jdbcUrl,
                    postgres.username,
                    postgres.password,
                )
            }

            migrateTo(postgres, "3")
            postgres.createConnection("").use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute(
                        """
                        INSERT INTO users (id, display_name)
                        VALUES ('10000000-0000-4000-8000-000000000001', 'Pre-V4 user')
                        """.trimIndent(),
                    )
                    statement.execute(
                        """
                        INSERT INTO accounts (id, account_id, provider_id, user_id)
                        VALUES (
                            '20000000-0000-4000-8000-000000000001',
                            'google-subject',
                            'google',
                            '10000000-0000-4000-8000-000000000001'
                        )
                        """.trimIndent(),
                    )
                }
            }

            val result =
                PreV4MigrationPreflight.run(
                    postgres.jdbcUrl,
                    postgres.username,
                    postgres.password,
                )
            assertEquals("3", result.flywayVersion)

            postgres.createConnection("").use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute(
                        "ALTER TABLE accounts DROP CONSTRAINT accounts_user_id_users_id_fk",
                    )
                    statement.execute(
                        """
                        UPDATE accounts
                        SET user_id = '30000000-0000-4000-8000-000000000001'
                        """.trimIndent(),
                    )
                }

                val report = PreV4MigrationPreflight.verify(connection)
                assertTrue(report.unexpectedUuidColumns.isEmpty())
                assertEquals(
                    listOf("accounts.user_id -> users.id has 1 orphaned values"),
                    report.relationshipViolations,
                )
            }
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
}
