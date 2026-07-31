package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.FlywayException
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import java.time.Instant
import java.time.OffsetDateTime
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class GoogleIdentityBackfillMigrationTest {
    @Test
    fun `V6 backfills missing Google identities without changing existing identities`() {
        val postgres = PostgreSQLContainer(TEST_POSTGRES_IMAGE)
        postgres.start()
        try {
            migrateThroughV5(postgres)
            postgres.createConnection("").use(::insertLegacyAccounts)

            migrateThroughLatest(postgres)

            postgres.createConnection("").use { connection ->
                assertEquals(
                    listOf(
                        IdentityRow(
                            "existing-google-subject",
                            1001,
                            Instant.parse("2026-07-29T12:00:00Z"),
                        ),
                        IdentityRow(
                            "missing-google-subject",
                            1002,
                            Instant.parse("2026-07-28T12:00:00Z"),
                        ),
                    ),
                    googleIdentities(connection),
                )
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '6'
                          AND script = 'V6__backfill_google_oidc_identities.sql'
                        """.trimIndent(),
                    ),
                )
            }
        } finally {
            postgres.stop()
        }
    }

    @Test
    fun `V6 fails when an existing Google identity belongs to a different user`() {
        val postgres = PostgreSQLContainer(TEST_POSTGRES_IMAGE)
        postgres.start()
        try {
            migrateThroughV5(postgres)
            postgres.createConnection("").use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute(
                        """
                        INSERT INTO users (id, display_name)
                        VALUES (1001, 'Legacy owner'), (1002, 'Identity owner')
                        """.trimIndent(),
                    )
                    statement.execute(
                        """
                        INSERT INTO accounts (
                            id, account_id, provider_id, user_id
                        ) VALUES (
                            2001, 'conflicting-subject', 'google', 1001
                        )
                        """.trimIndent(),
                    )
                    statement.execute(
                        """
                        INSERT INTO user_identities (
                            id, issuer, subject, user_id
                        ) VALUES (
                            3001,
                            'https://accounts.google.com',
                            'conflicting-subject',
                            1002
                        )
                        """.trimIndent(),
                    )
                }
            }

            assertFailsWith<FlywayException> {
                migrateThroughLatest(postgres)
            }
        } finally {
            postgres.stop()
        }
    }

    private fun migrateThroughV5(postgres: PostgreSQLContainer) {
        Flyway
            .configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .target(MigrationVersion.fromVersion("5"))
            .load()
            .migrate()
    }

    private fun migrateThroughLatest(postgres: PostgreSQLContainer) {
        Flyway
            .configure()
            .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
            .load()
            .migrate()
    }

    private fun insertLegacyAccounts(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO users (id, display_name)
                VALUES
                    (1001, 'Existing identity owner'),
                    (1002, 'Missing identity owner'),
                    (1003, 'Non-Google account owner')
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO accounts (
                    id, account_id, provider_id, user_id, created_at
                ) VALUES
                    (
                        2001,
                        'existing-google-subject',
                        'google',
                        1001,
                        '2026-07-27T12:00:00Z'
                    ),
                    (
                        2002,
                        'missing-google-subject',
                        'google',
                        1002,
                        '2026-07-28T12:00:00Z'
                    ),
                    (
                        2003,
                        'github-subject',
                        'github',
                        1003,
                        '2026-07-28T12:00:00Z'
                    )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO user_identities (
                    id, issuer, subject, user_id, created_at
                ) VALUES (
                    3001,
                    'https://accounts.google.com',
                    'existing-google-subject',
                    1001,
                    '2026-07-29T12:00:00Z'
                )
                """.trimIndent(),
            )
        }
    }

    private fun googleIdentities(connection: Connection): List<IdentityRow> =
        connection.createStatement().use { statement ->
            statement
                .executeQuery(
                    """
                    SELECT subject, user_id, created_at
                    FROM user_identities
                    WHERE issuer = 'https://accounts.google.com'
                    ORDER BY subject
                    """.trimIndent(),
                ).use { resultSet ->
                    buildList {
                        while (resultSet.next()) {
                            add(
                                IdentityRow(
                                    subject = resultSet.getString(1),
                                    userId = resultSet.getLong(2),
                                    createdAt =
                                        resultSet
                                            .getObject(3, OffsetDateTime::class.java)
                                            .toInstant(),
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

private data class IdentityRow(
    val subject: String,
    val userId: Long,
    val createdAt: Instant,
)
