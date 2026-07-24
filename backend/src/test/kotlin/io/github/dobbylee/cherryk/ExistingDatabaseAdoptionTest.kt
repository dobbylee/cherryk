package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.preflight.SchemaPreflight
import io.github.dobbylee.cherryk.preflight.ExistingDatabaseAdoption
import io.github.dobbylee.cherryk.preflight.ExistingDatabaseAdoptionCommand
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.datasource.init.ScriptUtils
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class ExistingDatabaseAdoptionTest {
    @Test
    fun `verified Drizzle database can be baselined and migrated without data loss`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            postgres.createConnection("").use { connection ->
                ScriptUtils.executeSqlScript(
                    connection,
                    ClassPathResource("db/migration/B1__drizzle_baseline.sql"),
                )
                insertExistingQuizData(connection)

                val report = SchemaPreflight.verify(connection)
                assertTrue(report.schemaErrors.isEmpty(), report.schemaErrors.joinToString())
                assertEquals(0L, report.quizReadiness.totalViolations)
            }

            val result =
                ExistingDatabaseAdoption.run(
                    url = postgres.jdbcUrl,
                    username = postgres.username,
                    password = postgres.password,
                )

            assertEquals("1", result.baselineVersion)
            assertEquals("2", result.migrationVersion)
            postgres.createConnection("").use { connection ->
                assertRowCount(
                    connection,
                    "corrections",
                    "50000000-0000-4000-8000-000000000001",
                    1,
                )
                assertRowCount(
                    connection,
                    "correction_mistakes",
                    "60000000-0000-4000-8000-000000000001",
                    1,
                )
                assertRowCount(
                    connection,
                    "quiz_questions",
                    "20000000-0000-4000-8000-000000000001",
                    1,
                )
                assertRowCount(
                    connection,
                    "quiz_attempts",
                    "40000000-0000-4000-8000-000000000001",
                    1,
                )
                connection.createStatement().use { statement ->
                    statement.executeQuery(
                        """
                        SELECT count(*)
                        FROM user_tag_stats
                        WHERE user_id = '10000000-0000-4000-8000-000000000001'
                          AND tag = 'particle_object'
                        """.trimIndent(),
                    ).use { resultSet ->
                        resultSet.next()
                        assertEquals(1, resultSet.getInt(1))
                    }
                    statement.executeQuery(
                        """
                        SELECT count(*)
                        FROM flyway_schema_history
                        WHERE success = true
                          AND version = '2'
                          AND script = 'V2__quiz_lifecycle_constraints.sql'
                        """.trimIndent(),
                    ).use { resultSet ->
                        resultSet.next()
                        assertEquals(1, resultSet.getInt(1))
                    }
                }
            }
        } finally {
            postgres.stop()
        }
    }

    @Test
    fun `adoption safety guards refuse mutation before V2`() {
        val postgres = PostgreSQLContainer("postgres:18")
        postgres.start()
        try {
            postgres.createConnection("").use { connection ->
                ScriptUtils.executeSqlScript(
                    connection,
                    ClassPathResource("db/migration/B1__drizzle_baseline.sql"),
                )
            }

            assertFailsWith<IllegalArgumentException> {
                adoptionCommand(postgres, confirmation = "WRONG").execute()
            }
            assertAdoptionNotStarted(postgres)

            assertFailsWith<IllegalArgumentException> {
                adoptionCommand(postgres, expectedHost = "wrong.example.com").execute()
            }
            assertAdoptionNotStarted(postgres)

            postgres.createConnection("").use { connection ->
                connection.createStatement().use { statement ->
                    statement.execute("CREATE SCHEMA other")
                }
            }
            assertFailsWith<IllegalStateException> {
                val separator = if ("?" in postgres.jdbcUrl) "&" else "?"
                adoptionCommand(
                    postgres,
                    url = "${postgres.jdbcUrl}${separator}currentSchema=other",
                ).execute()
            }
            assertAdoptionNotStarted(postgres)

            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .baselineVersion(MigrationVersion.fromVersion("1"))
                .baselineDescription("Existing history")
                .load()
                .baseline()

            assertFailsWith<IllegalStateException> {
                adoptionCommand(postgres).execute()
            }
            assertV2NotApplied(postgres)
        } finally {
            postgres.stop()
        }
    }

    private fun insertExistingQuizData(connection: Connection) {
        connection.createStatement().use { statement ->
            statement.execute(
                """
                INSERT INTO users (id, display_name)
                VALUES ('10000000-0000-4000-8000-000000000001', 'Existing user')
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO corrections (
                    id, user_id, input_type, original_text, corrected_text, explanation_en
                ) VALUES (
                    '50000000-0000-4000-8000-000000000001',
                    '10000000-0000-4000-8000-000000000001',
                    'text',
                    '저는 학교에 공부했어요.',
                    '저는 학교에서 공부했어요.',
                    'Use 에서.'
                )
                """.trimIndent(),
            )
            statement.execute(
                """
                INSERT INTO correction_mistakes (
                    id, correction_id, tag, original_part, corrected_part, explanation_en
                ) VALUES (
                    '60000000-0000-4000-8000-000000000001',
                    '50000000-0000-4000-8000-000000000001',
                    'particle_object',
                    '학교에',
                    '학교에서',
                    'Use 에서.'
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
                    '20000000-0000-4000-8000-000000000001',
                    'particle_object',
                    'beginner',
                    'existing-fingerprint',
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
                        '30000000-0000-4000-8000-000000000001',
                        '20000000-0000-4000-8000-000000000001',
                        'one',
                        true,
                        0
                    ),
                    (
                        '30000000-0000-4000-8000-000000000002',
                        '20000000-0000-4000-8000-000000000001',
                        'two',
                        false,
                        1
                    ),
                    (
                        '30000000-0000-4000-8000-000000000003',
                        '20000000-0000-4000-8000-000000000001',
                        'three',
                        false,
                        2
                    ),
                    (
                        '30000000-0000-4000-8000-000000000004',
                        '20000000-0000-4000-8000-000000000001',
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
                    '40000000-0000-4000-8000-000000000001',
                    '10000000-0000-4000-8000-000000000001',
                    '20000000-0000-4000-8000-000000000001',
                    '30000000-0000-4000-8000-000000000001',
                    true
                )
                """.trimIndent(),
            )
        }
    }

    private fun assertRowCount(
        connection: Connection,
        table: String,
        id: String,
        expected: Int,
    ) {
        require(table in setOf("corrections", "correction_mistakes", "quiz_questions", "quiz_attempts"))
        connection
            .prepareStatement("SELECT count(*) FROM $table WHERE id = ?")
            .use { statement ->
                statement.setObject(1, java.util.UUID.fromString(id))
                statement.executeQuery().use { resultSet ->
                    resultSet.next()
                    assertEquals(expected, resultSet.getInt(1))
                }
            }
    }

    private fun adoptionCommand(
        postgres: PostgreSQLContainer,
        url: String = postgres.jdbcUrl,
        confirmation: String = "BASELINE_DRIZZLE_AND_MIGRATE_TO_V2",
        expectedHost: String = java.net.URI(postgres.jdbcUrl.removePrefix("jdbc:")).host,
    ): ExistingDatabaseAdoptionCommand =
        ExistingDatabaseAdoptionCommand(
            url = url,
            username = postgres.username,
            password = postgres.password,
            confirmation = confirmation,
            expectedHost = expectedHost,
        )

    private fun assertAdoptionNotStarted(postgres: PostgreSQLContainer) {
        postgres.createConnection("").use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    "SELECT to_regclass('public.flyway_schema_history') IS NULL",
                ).use { resultSet ->
                    resultSet.next()
                    assertTrue(resultSet.getBoolean(1))
                }
            }
        }
        assertV2NotApplied(postgres)
    }

    private fun assertV2NotApplied(postgres: PostgreSQLContainer) {
        postgres.createConnection("").use { connection ->
            connection.createStatement().use { statement ->
                statement.executeQuery(
                    """
                    SELECT count(*) = 0
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'quiz_questions'
                      AND column_name = 'supersedes_quiz_id'
                    """.trimIndent(),
                ).use { resultSet ->
                    resultSet.next()
                    assertTrue(resultSet.getBoolean(1))
                }
            }
        }
    }
}
