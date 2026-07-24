package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.preflight.SchemaPreflight
import org.flywaydb.core.Flyway
import org.flywaydb.core.api.MigrationVersion
import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.datasource.init.ScriptUtils
import org.testcontainers.postgresql.PostgreSQLContainer
import java.sql.Connection
import kotlin.test.assertEquals
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

            val flyway =
                Flyway
                    .configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                    .baselineVersion(MigrationVersion.fromVersion("1"))
                    .baselineDescription("Drizzle schema baseline")
                    .load()

            flyway.baseline()
            val migrationResult = flyway.migrate()

            assertEquals("2", migrationResult.targetSchemaVersion)
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
}
