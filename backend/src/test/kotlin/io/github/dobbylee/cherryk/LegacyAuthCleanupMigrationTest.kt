package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.FlywayException
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class LegacyAuthCleanupMigrationTest {
    @Test
    fun `V9 removes legacy auth tables after preserving the Google identity`() {
        withPostgres { postgres ->
            migrate(postgres, target = "5")
            postgres.createConnection("").use(::insertLegacyGoogleData)

            migrate(postgres)

            postgres.createConnection("").use { connection ->
                assertFalse(tableExists(connection, "accounts"))
                assertFalse(tableExists(connection, "auth_sessions"))
                assertFalse(tableExists(connection, "verifications"))
                assertTrue(tableExists(connection, "user_identities"))
                assertTrue(tableExists(connection, "spring_session"))
                assertEquals(1, queryInt(connection, "SELECT count(*) FROM users"))
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM user_identities
                        WHERE issuer = 'https://accounts.google.com'
                          AND subject = 'legacy-google-subject'
                          AND user_id = 1001
                        """.trimIndent(),
                    ),
                )
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '9'
                          AND script = 'V9__remove_legacy_auth_tables.sql'
                        """.trimIndent(),
                    ),
                )
            }
        }
    }

    @Test
    fun `V9 refuses to remove an unsupported legacy provider`() {
        withPostgres { postgres ->
            migrate(postgres, target = "5")
            postgres.createConnection("").use { connection ->
                insertUser(connection, id = 1001)
                connection.createStatement().use { statement ->
                    statement.execute(
                        """
                        INSERT INTO accounts (id, account_id, provider_id, user_id)
                        VALUES (2001, 'legacy-github-subject', 'github', 1001)
                        """.trimIndent(),
                    )
                }
            }

            assertFailsWith<FlywayException> { migrate(postgres) }

            postgres.createConnection("").use { connection ->
                assertTrue(tableExists(connection, "accounts"))
                assertEquals(1, queryInt(connection, "SELECT count(*) FROM accounts"))
            }
        }
    }

    @Test
    fun `V9 refuses to remove a Google account with no OIDC identity`() {
        withPostgres { postgres ->
            migrate(postgres, target = "8")
            postgres.createConnection("").use { connection ->
                insertUser(connection, id = 1001)
                connection.createStatement().use { statement ->
                    statement.execute(
                        """
                        INSERT INTO accounts (id, account_id, provider_id, user_id)
                        VALUES (2001, 'missing-google-subject', 'google', 1001)
                        """.trimIndent(),
                    )
                }
            }

            assertFailsWith<FlywayException> { migrate(postgres) }

            postgres.createConnection("").use { connection ->
                assertTrue(tableExists(connection, "accounts"))
                assertEquals(0, queryInt(connection, "SELECT count(*) FROM user_identities"))
            }
        }
    }

    @Test
    fun `V9 refuses to remove a Google account mapped to a different user`() {
        withPostgres { postgres ->
            migrate(postgres, target = "8")
            postgres.createConnection("").use { connection ->
                insertUser(connection, id = 1001)
                insertUser(connection, id = 1002)
                connection.createStatement().use { statement ->
                    statement.execute(
                        """
                        INSERT INTO accounts (id, account_id, provider_id, user_id)
                        VALUES (2001, 'conflicting-google-subject', 'google', 1001)
                        """.trimIndent(),
                    )
                    statement.execute(
                        """
                        INSERT INTO user_identities (id, issuer, subject, user_id)
                        VALUES (
                            3001,
                            'https://accounts.google.com',
                            'conflicting-google-subject',
                            1002
                        )
                        """.trimIndent(),
                    )
                }
            }

            assertFailsWith<FlywayException> { migrate(postgres) }

            postgres.createConnection("").use { connection ->
                assertTrue(tableExists(connection, "accounts"))
                assertEquals(1, queryInt(connection, "SELECT count(*) FROM accounts"))
            }
        }
    }

    private fun insertLegacyGoogleData(connection: Connection) {
        insertUser(connection, id = 1001)
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO accounts (id, account_id, provider_id, user_id)
                VALUES (2001, 'legacy-google-subject', 'google', 1001)
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO auth_sessions (id, token, expires_at, user_id)
                VALUES (3001, 'legacy-session-token', now() + interval '1 day', 1001)
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO verifications (id, identifier, value, expires_at)
                VALUES (4001, 'legacy-identifier', 'legacy-value', now() + interval '1 day')
                """.trimIndent(),
            )
        }
    }

    private fun insertUser(
        connection: Connection,
        id: Long,
    ) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO users (id, display_name, email)
                VALUES ($id, 'Legacy user $id', 'legacy-$id@example.com')
                """.trimIndent(),
            )
        }
    }

    private fun migrate(
        postgres: PostgreSQLContainer,
        target: String? = null,
    ) {
        val configuration =
            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
        target?.let { configuration.target(MigrationVersion.fromVersion(it)) }
        configuration.load().migrate()
    }

    private fun tableExists(
        connection: Connection,
        table: String,
    ): Boolean {
        require(table.matches(Regex("[a-z_]+")))
        return connection
            .prepareStatement(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = ?
                )
                """.trimIndent(),
            ).use { statement ->
                statement.setString(1, table)
                statement.executeQuery().use { resultSet ->
                    resultSet.next()
                    resultSet.getBoolean(1)
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

    private fun withPostgres(block: (PostgreSQLContainer) -> Unit) {
        val postgres = PostgreSQLContainer(TEST_POSTGRES_IMAGE)
        postgres.start()
        try {
            block(postgres)
        } finally {
            postgres.stop()
        }
    }
}
