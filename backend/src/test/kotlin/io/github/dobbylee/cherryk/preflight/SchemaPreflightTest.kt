package io.github.dobbylee.cherryk.preflight

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import java.sql.Connection
import javax.sql.DataSource
import kotlin.test.assertTrue

@SpringBootTest
class SchemaPreflightTest(
    @Autowired private val dataSource: DataSource,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `rejects same-named definition drift and unexpected indexes`() {
        withRollback { connection ->
            connection.createStatement().use { statement ->
                statement.execute("DROP INDEX accounts_provider_account_unique")
                statement.execute(
                    """
                    CREATE UNIQUE INDEX accounts_provider_account_unique
                    ON accounts (account_id, provider_id)
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    ALTER TABLE quiz_attempts
                    DROP CONSTRAINT quiz_attempts_selected_choice_id_quiz_choices_id_fk
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    ALTER TABLE quiz_attempts
                    ADD CONSTRAINT quiz_attempts_selected_choice_id_quiz_choices_id_fk
                    FOREIGN KEY (selected_choice_id) REFERENCES users (id)
                    ON DELETE CASCADE
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    CREATE INDEX users_unexpected_display_name_idx
                    ON users (display_name)
                    """.trimIndent(),
                )
            }

            val errors = SchemaPreflight.verify(connection).schemaErrors

            assertTrue(errors.any { it.startsWith("Index drift in accounts") })
            assertTrue(errors.any { it.startsWith("Constraint drift in quiz_attempts") })
            assertTrue(errors.any { it.startsWith("Index drift in users") })
        }
    }

    @Test
    fun `rejects an otherwise matching foreign key that is not validated`() {
        withRollback { connection ->
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    ALTER TABLE quiz_attempts
                    DROP CONSTRAINT quiz_attempts_selected_choice_id_quiz_choices_id_fk
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    ALTER TABLE quiz_attempts
                    ADD CONSTRAINT quiz_attempts_selected_choice_id_quiz_choices_id_fk
                    FOREIGN KEY (selected_choice_id) REFERENCES quiz_choices (id)
                    NOT VALID
                    """.trimIndent(),
                )
            }

            val errors = SchemaPreflight.verify(connection).schemaErrors

            assertTrue(errors.any { it.startsWith("Constraint drift in quiz_attempts") })
        }
    }

    @Test
    fun `reports every planned quiz lifecycle data blocker`() {
        withRollback { connection ->
            connection.createStatement().use { statement ->
                statement.execute(
                    """
                    INSERT INTO users (id, display_name)
                    VALUES ('10000000-0000-4000-8000-000000000001', 'Preflight user')
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    INSERT INTO quiz_questions (
                        id, tag, difficulty, content_fingerprint, status,
                        question_en, sentence_ko, answer_explanation_en
                    ) VALUES
                        (
                            '20000000-0000-4000-8000-000000000001',
                            'particle_object',
                            'expert',
                            'preflight-invalid-enum',
                            'future',
                            'Choose.',
                            '문장',
                            'Explanation.'
                        ),
                        (
                            '20000000-0000-4000-8000-000000000002',
                            'particle_object',
                            'beginner',
                            'preflight-invalid-approved',
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
                            'one', true, 0
                        ),
                        (
                            '30000000-0000-4000-8000-000000000002',
                            '20000000-0000-4000-8000-000000000001',
                            'two', true, 0
                        ),
                        (
                            '30000000-0000-4000-8000-000000000003',
                            '20000000-0000-4000-8000-000000000001',
                            'three', false, 2
                        ),
                        (
                            '30000000-0000-4000-8000-000000000004',
                            '20000000-0000-4000-8000-000000000001',
                            'four', false, 3
                        ),
                        (
                            '30000000-0000-4000-8000-000000000005',
                            '20000000-0000-4000-8000-000000000001',
                            'five', false, 4
                        ),
                        (
                            '30000000-0000-4000-8000-000000000006',
                            '20000000-0000-4000-8000-000000000002',
                            'approved one', false, 0
                        ),
                        (
                            '30000000-0000-4000-8000-000000000007',
                            '20000000-0000-4000-8000-000000000002',
                            'approved two', false, 1
                        ),
                        (
                            '30000000-0000-4000-8000-000000000008',
                            '20000000-0000-4000-8000-000000000002',
                            'approved three', false, 2
                        ),
                        (
                            '30000000-0000-4000-8000-000000000009',
                            '20000000-0000-4000-8000-000000000002',
                            'approved four', false, 3
                        )
                    """.trimIndent(),
                )
                statement.execute(
                    """
                    INSERT INTO quiz_attempts (
                        id, user_id, quiz_question_id, selected_choice_id, is_correct
                    ) VALUES
                        (
                            '40000000-0000-4000-8000-000000000001',
                            '10000000-0000-4000-8000-000000000001',
                            '20000000-0000-4000-8000-000000000001',
                            NULL,
                            false
                        ),
                        (
                            '40000000-0000-4000-8000-000000000002',
                            '10000000-0000-4000-8000-000000000001',
                            '20000000-0000-4000-8000-000000000002',
                            '30000000-0000-4000-8000-000000000001',
                            false
                        )
                    """.trimIndent(),
                )
            }

            val readiness = SchemaPreflight.verify(connection).quizReadiness

            assertTrue(readiness.nullSelectedChoices > 0)
            assertTrue(readiness.invalidChoiceOwnership > 0)
            assertTrue(readiness.quizzesWithoutFourChoices > 0)
            assertTrue(readiness.approvedWithoutOneAnswer > 0)
            assertTrue(readiness.quizzesWithDuplicateSortOrder > 0)
            assertTrue(readiness.choicesWithOutOfRangeSortOrder > 0)
            assertTrue(readiness.quizzesWithUnsupportedStatus > 0)
            assertTrue(readiness.quizzesWithUnsupportedDifficulty > 0)
            assertTrue(readiness.quizzesWithMultipleCorrectChoices > 0)
        }
    }

    private fun withRollback(block: (Connection) -> Unit) {
        dataSource.connection.use { connection ->
            connection.autoCommit = false
            try {
                block(connection)
            } finally {
                connection.rollback()
            }
        }
    }
}
