package io.github.dobbylee.cherryk

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

@SpringBootTest
@Transactional
class QuizLifecycleMigrationTest(
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `V2 installs the quiz lifecycle schema`() {
        val successfulMigrationCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM flyway_schema_history
                    WHERE success = true
                      AND script = 'V2__quiz_lifecycle_constraints.sql'
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()
        val selectedChoiceIsNullable =
            jdbcClient
                .sql(
                    """
                    SELECT is_nullable = 'YES'
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'quiz_attempts'
                      AND column_name = 'selected_choice_id'
                    """.trimIndent(),
                ).query(Boolean::class.java)
                .single()
        val supersedesColumnCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM information_schema.columns
                    WHERE table_schema = 'public'
                      AND table_name = 'quiz_questions'
                      AND column_name = 'supersedes_quiz_id'
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()

        assertEquals(1, successfulMigrationCount)
        assertFalse(selectedChoiceIsNullable)
        assertEquals(1, supersedesColumnCount)
    }

    @Test
    fun `rejects an attempt whose selected choice belongs to another quiz`() {
        val userId = insertUser()
        val attemptedQuizId = insertQuiz(status = "approved")
        val otherQuizId = insertQuiz(status = "approved")
        val otherChoiceId = insertChoice(otherQuizId, correct = true, sortOrder = 0)

        assertFailsWith<DataIntegrityViolationException> {
            jdbcClient
                .sql(
                    """
                    INSERT INTO quiz_attempts (
                        id, user_id, quiz_question_id, selected_choice_id, is_correct
                    ) VALUES (
                        :id, :userId, :quizId, :choiceId, false
                    )
                    """.trimIndent(),
                ).param("id", UUID.randomUUID())
                .param("userId", userId)
                .param("quizId", attemptedQuizId)
                .param("choiceId", otherChoiceId)
                .update()
        }
    }

    @Test
    fun `rejects unsupported quiz lifecycle states`() {
        assertFailsWith<DataIntegrityViolationException> {
            insertQuiz(status = "future")
        }
    }

    @Test
    fun `rejects duplicate choice order`() {
        val quizId = insertQuiz()
        insertChoice(quizId, correct = true, sortOrder = 0)

        assertFailsWith<DataIntegrityViolationException> {
            insertChoice(quizId, correct = false, sortOrder = 0)
        }
    }

    @Test
    fun `rejects more than one correct choice`() {
        val quizId = insertQuiz()
        insertChoice(quizId, correct = true, sortOrder = 0)

        assertFailsWith<DataIntegrityViolationException> {
            insertChoice(quizId, correct = true, sortOrder = 1)
        }
    }

    @Test
    fun `allows a revision draft to replace its retired quiz`() {
        val fingerprint = "revision-${UUID.randomUUID()}"
        val originalId = insertQuiz(status = "approved", fingerprint = fingerprint)
        val revisionId =
            insertQuiz(
                status = "draft",
                fingerprint = fingerprint,
                supersedesQuizId = originalId,
            )

        jdbcClient
            .sql("UPDATE quiz_questions SET status = 'retired' WHERE id = :id")
            .param("id", originalId)
            .update()
        jdbcClient
            .sql("UPDATE quiz_questions SET status = 'approved' WHERE id = :id")
            .param("id", revisionId)
            .update()

        val activeStatuses =
            jdbcClient
                .sql(
                    """
                    SELECT status
                    FROM quiz_questions
                    WHERE id IN (:originalId, :revisionId)
                    ORDER BY status
                    """.trimIndent(),
                ).param("originalId", originalId)
                .param("revisionId", revisionId)
                .query(String::class.java)
                .list()

        assertEquals(listOf("approved", "retired"), activeStatuses)
    }

    @Test
    fun `requires the old approved quiz to retire before revision approval`() {
        val fingerprint = "approval-order-${UUID.randomUUID()}"
        val originalId = insertQuiz(status = "approved", fingerprint = fingerprint)
        val revisionId =
            insertQuiz(
                status = "draft",
                fingerprint = fingerprint,
                supersedesQuizId = originalId,
            )

        assertFailsWith<DataIntegrityViolationException> {
            jdbcClient
                .sql("UPDATE quiz_questions SET status = 'approved' WHERE id = :id")
                .param("id", revisionId)
                .update()
        }
    }

    @Test
    fun `rejects an ordinary draft that duplicates an approved quiz`() {
        val fingerprint = "ordinary-duplicate-${UUID.randomUUID()}"
        insertQuiz(status = "approved", fingerprint = fingerprint)

        assertFailsWith<DataIntegrityViolationException> {
            insertQuiz(status = "draft", fingerprint = fingerprint)
        }
    }

    @Test
    fun `allows only one revision draft per target quiz`() {
        val originalId = insertQuiz(status = "approved")
        insertQuiz(
            status = "draft",
            fingerprint = "first-revision-${UUID.randomUUID()}",
            supersedesQuizId = originalId,
        )

        assertFailsWith<DataIntegrityViolationException> {
            insertQuiz(
                status = "draft",
                fingerprint = "second-revision-${UUID.randomUUID()}",
                supersedesQuizId = originalId,
            )
        }
    }

    private fun insertUser(): UUID {
        val id = UUID.randomUUID()
        jdbcClient
            .sql("INSERT INTO users (id, display_name) VALUES (:id, 'Migration user')")
            .param("id", id)
            .update()
        return id
    }

    private fun insertQuiz(
        status: String = "draft",
        fingerprint: String = "migration-${UUID.randomUUID()}",
        supersedesQuizId: UUID? = null,
    ): UUID {
        val id = UUID.randomUUID()
        val query =
            if (supersedesQuizId == null) {
                jdbcClient.sql(
                    """
                    INSERT INTO quiz_questions (
                        id, tag, difficulty, content_fingerprint, status,
                        question_en, sentence_ko, answer_explanation_en
                    ) VALUES (
                        :id, 'particle_object', 'beginner', :fingerprint, :status,
                        'Choose.', '문장', 'Explanation.'
                    )
                    """.trimIndent(),
                )
            } else {
                jdbcClient
                    .sql(
                        """
                        INSERT INTO quiz_questions (
                            id, tag, difficulty, content_fingerprint, supersedes_quiz_id,
                            status, question_en, sentence_ko, answer_explanation_en
                        ) VALUES (
                            :id, 'particle_object', 'beginner', :fingerprint, :supersedesQuizId,
                            :status, 'Choose.', '문장', 'Explanation.'
                        )
                        """.trimIndent(),
                    ).param("supersedesQuizId", supersedesQuizId)
            }

        query
            .param("id", id)
            .param("fingerprint", fingerprint)
            .param("status", status)
            .update()
        return id
    }

    private fun insertChoice(
        quizId: UUID,
        correct: Boolean,
        sortOrder: Int,
    ): UUID {
        val id = UUID.randomUUID()
        jdbcClient
            .sql(
                """
                INSERT INTO quiz_choices (
                    id, quiz_question_id, choice_text, is_correct, sort_order
                ) VALUES (
                    :id, :quizId, 'Choice', :correct, :sortOrder
                )
                """.trimIndent(),
            ).param("id", id)
            .param("quizId", quizId)
            .param("correct", correct)
            .param("sortOrder", sortOrder)
            .update()
        return id
    }
}
