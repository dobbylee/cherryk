package io.github.dobbylee.cherryk

import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class BigintIdentityMigrationTest {
    @Test
    fun `V4 converts entity ids and foreign keys without losing application data`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            val configuration =
                Flyway
                    .configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)

            configuration
                .target(MigrationVersion.fromVersion("3"))
                .load()
                .migrate()
            postgres.createConnection("").use(::insertUuidData)
            val rowCountsBefore = postgres.createConnection("").use(::rowCounts)

            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .load()
                .migrate()

            postgres.createConnection("").use { connection ->
                assertEquals(rowCountsBefore, rowCounts(connection))
                assertEquals(0, applicationUuidColumnCount(connection))
                assertIdentityIds(connection)
                assertRelationships(connection)
                assertNextIdentityValueWorks(connection)
                assertEquals(
                    1,
                    queryInt(
                        connection,
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '4'
                          AND script = 'V4__bigint_identity_primary_keys.sql'
                        """.trimIndent(),
                    ),
                )
            }
        } finally {
            postgres.stop()
        }
    }

    private fun insertUuidData(connection: Connection) {
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
                    '11000000-0000-4000-8000-000000000001',
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
                    '12000000-0000-4000-8000-000000000001',
                    'legacy-session-token',
                    now() + interval '1 day',
                    '10000000-0000-4000-8000-000000000001'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO verifications (id, identifier, value, expires_at)
                VALUES (
                    '13000000-0000-4000-8000-000000000001',
                    'identifier',
                    'value',
                    now() + interval '1 day'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO daily_usage (user_id, usage_date, correction_count, ocr_count)
                VALUES (
                    '10000000-0000-4000-8000-000000000001',
                    '2026-07-24',
                    2,
                    1
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO corrections (
                    id, user_id, input_type, original_text, corrected_text
                ) VALUES (
                    '20000000-0000-4000-8000-000000000001',
                    '10000000-0000-4000-8000-000000000001',
                    'text',
                    'original',
                    'corrected'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO correction_mistakes (
                    id, correction_id, tag, original_part, corrected_part
                ) VALUES (
                    '21000000-0000-4000-8000-000000000001',
                    '20000000-0000-4000-8000-000000000001',
                    'particle_object',
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
                    2
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO quiz_questions (
                    id, tag, difficulty, content_fingerprint, status,
                    question_en, sentence_ko, answer_explanation_en
                ) VALUES (
                    '30000000-0000-4000-8000-000000000001',
                    'particle_object',
                    'beginner',
                    'identity-migration-fingerprint',
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
                        '31000000-0000-4000-8000-000000000001',
                        '30000000-0000-4000-8000-000000000001',
                        'one',
                        true,
                        0
                    ),
                    (
                        '31000000-0000-4000-8000-000000000002',
                        '30000000-0000-4000-8000-000000000001',
                        'two',
                        false,
                        1
                    ),
                    (
                        '31000000-0000-4000-8000-000000000003',
                        '30000000-0000-4000-8000-000000000001',
                        'three',
                        false,
                        2
                    ),
                    (
                        '31000000-0000-4000-8000-000000000004',
                        '30000000-0000-4000-8000-000000000001',
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
                    '32000000-0000-4000-8000-000000000001',
                    '10000000-0000-4000-8000-000000000001',
                    '30000000-0000-4000-8000-000000000001',
                    '31000000-0000-4000-8000-000000000001',
                    true
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO user_identities (id, issuer, subject, user_id)
                VALUES (
                    '40000000-0000-4000-8000-000000000001',
                    'https://accounts.google.com',
                    'google-subject',
                    '10000000-0000-4000-8000-000000000001'
                )
                """.trimIndent(),
            )
        }
    }

    private fun assertIdentityIds(connection: Connection) {
        val entityTables =
            listOf(
                "users",
                "accounts",
                "auth_sessions",
                "verifications",
                "corrections",
                "correction_mistakes",
                "quiz_questions",
                "quiz_choices",
                "quiz_attempts",
                "user_identities",
            )

        entityTables.forEach { table ->
            connection
                .prepareStatement(
                    """
                    SELECT data_type, is_identity, identity_generation
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = ?
                      AND column_name = 'id'
                    """.trimIndent(),
                ).use { statement ->
                    statement.setString(1, table)
                    statement.executeQuery().use { resultSet ->
                        assertTrue(resultSet.next(), "Missing $table.id")
                        assertEquals("bigint", resultSet.getString("data_type"), table)
                        assertEquals("YES", resultSet.getString("is_identity"), table)
                        assertEquals("BY DEFAULT", resultSet.getString("identity_generation"), table)
                    }
                }
        }
    }

    private fun assertRelationships(connection: Connection) {
        assertEquals(
            1,
            queryInt(
                connection,
                """
                SELECT count(*)
                FROM users user_account
                JOIN accounts account ON account.user_id = user_account.id
                JOIN auth_sessions session ON session.user_id = user_account.id
                JOIN user_identities identity ON identity.user_id = user_account.id
                WHERE user_account.email = 'existing@example.com'
                  AND account.account_id = 'google-subject'
                  AND session.token = 'legacy-session-token'
                  AND identity.subject = 'google-subject'
                """.trimIndent(),
            ),
        )
        assertEquals(
            1,
            queryInt(
                connection,
                """
                SELECT count(*)
                FROM users user_account
                JOIN corrections correction ON correction.user_id = user_account.id
                JOIN correction_mistakes mistake ON mistake.correction_id = correction.id
                JOIN user_tag_stats stat ON stat.user_id = user_account.id
                JOIN daily_usage usage ON usage.user_id = user_account.id
                WHERE user_account.email = 'existing@example.com'
                  AND correction.original_text = 'original'
                  AND mistake.tag = 'particle_object'
                  AND stat.count = 2
                  AND usage.correction_count = 2
                """.trimIndent(),
            ),
        )
        assertEquals(
            1,
            queryInt(
                connection,
                """
                SELECT count(*)
                FROM quiz_attempts attempt
                JOIN quiz_questions question ON question.id = attempt.quiz_question_id
                JOIN quiz_choices choice
                  ON choice.quiz_question_id = attempt.quiz_question_id
                 AND choice.id = attempt.selected_choice_id
                WHERE question.content_fingerprint = 'identity-migration-fingerprint'
                  AND choice.is_correct
                  AND attempt.is_correct
                """.trimIndent(),
            ),
        )
    }

    private fun assertNextIdentityValueWorks(connection: Connection) {
        connection
            .prepareStatement(
                """
                INSERT INTO users (display_name, email)
                VALUES ('New identity user', 'new-identity@example.com')
                RETURNING id
                """.trimIndent(),
            ).use { statement ->
                statement.executeQuery().use { resultSet ->
                    assertTrue(resultSet.next())
                    assertTrue(resultSet.getLong(1) > 1)
                }
            }
    }

    private fun rowCounts(connection: Connection) =
        listOf(
            "users",
            "accounts",
            "auth_sessions",
            "verifications",
            "daily_usage",
            "corrections",
            "correction_mistakes",
            "user_tag_stats",
            "quiz_questions",
            "quiz_choices",
            "quiz_attempts",
            "user_identities",
            "spring_session",
            "spring_session_attributes",
        ).associateWith { table ->
            require(table.matches(Regex("[a-z_]+")))
            queryInt(connection, "SELECT count(*) FROM $table")
        }

    private fun applicationUuidColumnCount(connection: Connection): Int =
        queryInt(
            connection,
            """
            SELECT count(*)
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name IN (
                  'users',
                  'accounts',
                  'auth_sessions',
                  'verifications',
                  'daily_usage',
                  'corrections',
                  'correction_mistakes',
                  'user_tag_stats',
                  'quiz_questions',
                  'quiz_choices',
                  'quiz_attempts',
                  'user_identities'
              )
              AND data_type = 'uuid'
            """.trimIndent(),
        )

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
