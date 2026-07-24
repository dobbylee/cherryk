package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import java.sql.SQLException
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class AuthSchemaMigrationTest {
    @Test
    fun `V3 adds OIDC identity and Spring Session tables without changing existing data`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            val flyway =
                Flyway
                    .configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                    .target(MigrationVersion.fromVersion("2"))
                    .load()
            flyway.migrate()

            postgres.createConnection("").use(::insertExistingData)
            val before = postgres.createConnection("").use(::applicationRowCounts)

            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .load()
                .migrate()

            postgres.createConnection("").use { connection ->
                assertEquals(before, applicationRowCounts(connection))
                assertEquals(1, count(connection, "auth_sessions"))
                assertEquals(0, count(connection, "user_identities"))
                assertEquals(0, count(connection, "spring_session"))
                assertEquals(0, count(connection, "spring_session_attributes"))
                assertEquals(
                    1,
                    queryCount(
                        connection,
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '3'
                          AND script = 'V3__oidc_identity_and_spring_session.sql'
                        """.trimIndent(),
                    ),
                )

                connection
                    .createStatement()
                    .use { statement ->
                        statement.execute(
                            """
                            INSERT INTO user_identities (issuer, subject, user_id)
                            VALUES (
                                'https://accounts.google.com',
                                'google-subject',
                                '10000000-0000-4000-8000-000000000001'
                            )
                            """.trimIndent(),
                        )
                    }
                assertFailsWith<SQLException> {
                    connection
                        .createStatement()
                        .use { statement ->
                            statement.execute(
                                """
                                INSERT INTO user_identities (issuer, subject, user_id)
                                VALUES (
                                    'https://accounts.google.com',
                                    'google-subject',
                                    '10000000-0000-4000-8000-000000000001'
                                )
                                """.trimIndent(),
                            )
                        }
                }
            }
        } finally {
            postgres.stop()
        }
    }

    private fun insertExistingData(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO users (id, display_name, email)
                VALUES (
                    '10000000-0000-4000-8000-000000000001',
                    'Existing user',
                    'existing@example.com'
                )
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
            statement.execute(
                """
                INSERT INTO auth_sessions (id, token, expires_at, user_id)
                VALUES (
                    '30000000-0000-4000-8000-000000000001',
                    'legacy-session-token',
                    now() + interval '1 day',
                    '10000000-0000-4000-8000-000000000001'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO corrections (
                    id, user_id, input_type, original_text, corrected_text
                ) VALUES (
                    '40000000-0000-4000-8000-000000000001',
                    '10000000-0000-4000-8000-000000000001',
                    'text',
                    'original',
                    'corrected'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO user_tag_stats (user_id, tag, count)
                VALUES (
                    '10000000-0000-4000-8000-000000000001',
                    'particle_object',
                    1
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO quiz_questions (
                    id, tag, difficulty, content_fingerprint, status,
                    question_en, sentence_ko, answer_explanation_en
                ) VALUES (
                    '50000000-0000-4000-8000-000000000001',
                    'particle_object',
                    'beginner',
                    'auth-migration-fingerprint',
                    'approved',
                    'Choose.',
                    '문장',
                    'Explanation.'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO quiz_choices (
                    id, quiz_question_id, choice_text, is_correct, sort_order
                ) VALUES
                    (
                        '60000000-0000-4000-8000-000000000001',
                        '50000000-0000-4000-8000-000000000001',
                        'one',
                        true,
                        0
                    ),
                    (
                        '60000000-0000-4000-8000-000000000002',
                        '50000000-0000-4000-8000-000000000001',
                        'two',
                        false,
                        1
                    ),
                    (
                        '60000000-0000-4000-8000-000000000003',
                        '50000000-0000-4000-8000-000000000001',
                        'three',
                        false,
                        2
                    ),
                    (
                        '60000000-0000-4000-8000-000000000004',
                        '50000000-0000-4000-8000-000000000001',
                        'four',
                        false,
                        3
                    )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO quiz_attempts (
                    id, user_id, quiz_question_id, selected_choice_id, is_correct
                ) VALUES (
                    '70000000-0000-4000-8000-000000000001',
                    '10000000-0000-4000-8000-000000000001',
                    '50000000-0000-4000-8000-000000000001',
                    '60000000-0000-4000-8000-000000000001',
                    true
                )
                """.trimIndent(),
            )
        }
    }

    private fun applicationRowCounts(connection: Connection) =
        listOf(
            "users",
            "accounts",
            "corrections",
            "user_tag_stats",
            "quiz_questions",
            "quiz_choices",
            "quiz_attempts",
        )
            .associateWith { count(connection, it) }

    private fun count(
        connection: Connection,
        table: String,
    ): Int {
        require(
            table in
                setOf(
                    "users",
                    "accounts",
                    "auth_sessions",
                    "corrections",
                    "user_tag_stats",
                    "quiz_questions",
                    "quiz_choices",
                    "quiz_attempts",
                    "user_identities",
                    "spring_session",
                    "spring_session_attributes",
                ),
        )
        return queryCount(connection, "SELECT count(*) FROM $table")
    }

    private fun queryCount(
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
