package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.domain.quiz.learningTargetDigest
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
    fun `V7 defaults existing inserts to grammar`() {
        val successfulMigrationCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM flyway_schema_history
                    WHERE success = true
                      AND script = 'V7__add_vocabulary_quiz_type.sql'
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()
        val grammarQuizId = insertQuiz()
        val storedType =
            jdbcClient
                .sql("SELECT quiz_type FROM quiz_questions WHERE id = :id")
                .param("id", grammarQuizId)
                .query(String::class.java)
                .single()

        assertEquals(1, successfulMigrationCount)
        assertEquals("grammar", storedType)
    }

    @Test
    fun `V8 installs durable learning target history and a tiered vocabulary pool`() {
        val successfulMigrationCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM flyway_schema_history
                    WHERE success = true
                      AND script = 'V8__quiz_learning_targets_and_vocabulary_pool.sql'
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()
        val targetsByDifficulty =
            jdbcClient
                .sql(
                    """
                    SELECT difficulty, count(*)
                    FROM vocabulary_targets
                    GROUP BY difficulty
                    ORDER BY difficulty
                    """.trimIndent(),
                ).query { resultSet, _ ->
                    resultSet.getString("difficulty") to resultSet.getInt(2)
                }.list()
                .toMap()
        val invalidTargetCount =
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM vocabulary_targets
                    WHERE word_ko !~ '[가-힣]'
                       OR word_ko ~ '[A-Za-z]'
                       OR normalized_word <> lower(
                            regexp_replace(btrim(normalize(word_ko, NFC)), '[[:space:]]+', ' ', 'g')
                          )
                       OR target_digest <> encode(
                            sha256(convert_to(normalized_word, 'UTF8')),
                            'hex'
                          )
                       OR reservation_key IS NOT NULL
                       OR reserved_at IS NOT NULL
                    """.trimIndent(),
                ).query(Int::class.java)
                .single()

        assertEquals(1, successfulMigrationCount)
        assertEquals(
            mapOf(
                "beginner" to 81,
                "intermediate" to 89,
                "lower_intermediate" to 85,
            ),
            targetsByDifficulty,
        )
        assertEquals(0, invalidTargetCount)
    }

    @Test
    fun `learning target history survives quiz deletion and remains unique`() {
        val quizId = insertQuiz()
        insertChoice(quizId, correct = true, sortOrder = 0)
        val targetKey = "migration-target-${UUID.randomUUID()}"
        jdbcClient
            .sql(
                """
                INSERT INTO quiz_learning_targets (
                    quiz_question_id, quiz_type, tag, target_key, target_digest
                ) VALUES (
                    :quizId, 'grammar', 'particle_object', :targetKey, :targetDigest
                )
                """.trimIndent(),
            ).param("quizId", quizId)
            .param("targetKey", targetKey)
            .param("targetDigest", learningTargetDigest(targetKey))
            .update()

        jdbcClient
            .sql("DELETE FROM quiz_questions WHERE id = :quizId")
            .param("quizId", quizId)
            .update()

        assertEquals(
            1,
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM quiz_learning_targets
                    WHERE target_key = :targetKey
                      AND quiz_question_id IS NULL
                    """.trimIndent(),
            ).param("targetKey", targetKey)
                .query(Int::class.java)
                .single(),
        )
        assertFailsWith<DataIntegrityViolationException> {
            jdbcClient
                .sql(
                    """
                    INSERT INTO quiz_learning_targets (
                        quiz_type, tag, target_key, target_digest
                    ) VALUES (
                        'grammar', 'particle_object', :targetKey, :targetDigest
                    )
                    """.trimIndent(),
                ).param("targetKey", targetKey)
                .param("targetDigest", learningTargetDigest(targetKey))
                .update()
        }
    }

    @Test
    fun `V7 requires vocabulary quizzes to use the word choice tag`() {
        assertFailsWith<DataIntegrityViolationException> {
            jdbcClient
                .sql(
                    """
                    INSERT INTO quiz_questions (
                        quiz_type, tag, difficulty, content_fingerprint, status,
                        question_en, sentence_ko, answer_explanation_en
                    ) VALUES (
                        'vocabulary', 'particle_object', 'beginner', :fingerprint, 'draft',
                        'A place for books.', NULL, 'Library.'
                    )
                    """.trimIndent(),
                ).param("fingerprint", "invalid-vocabulary-${UUID.randomUUID()}")
                .update()
        }
    }

    @Test
    fun `V7 prevents vocabulary quizzes from storing a Korean sentence`() {
        assertFailsWith<DataIntegrityViolationException> {
            jdbcClient
                .sql(
                    """
                    INSERT INTO quiz_questions (
                        quiz_type, tag, difficulty, content_fingerprint, status,
                        question_en, sentence_ko, answer_explanation_en
                    ) VALUES (
                        'vocabulary', 'word_choice', 'beginner', :fingerprint, 'draft',
                        'A place for books.', '설명에 맞는 단어를 고르세요.', 'Library.'
                    )
                    """.trimIndent(),
                ).param("fingerprint", "invalid-vocabulary-sentence-${UUID.randomUUID()}")
                .update()
        }
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
                        user_id, quiz_question_id, selected_choice_id, is_correct
                    ) VALUES (
                        :userId, :quizId, :choiceId, false
                    )
                    """.trimIndent(),
                ).param("userId", userId)
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

    private fun insertUser(): Long =
        jdbcClient
            .sql("INSERT INTO users (display_name) VALUES ('Migration user') RETURNING id")
            .query(Long::class.java)
            .single()

    private fun insertQuiz(
        status: String = "draft",
        fingerprint: String = "migration-${UUID.randomUUID()}",
        supersedesQuizId: Long? = null,
    ): Long {
        val query =
            if (supersedesQuizId == null) {
                jdbcClient.sql(
                    """
                    INSERT INTO quiz_questions (
                        tag, difficulty, content_fingerprint, status,
                        question_en, sentence_ko, answer_explanation_en
                    ) VALUES (
                        'particle_object', 'beginner', :fingerprint, :status,
                        'Choose.', '문장', 'Explanation.'
                    )
                    RETURNING id
                    """.trimIndent(),
                )
            } else {
                jdbcClient
                    .sql(
                        """
                        INSERT INTO quiz_questions (
                            tag, difficulty, content_fingerprint, supersedes_quiz_id,
                            status, question_en, sentence_ko, answer_explanation_en
                        ) VALUES (
                            'particle_object', 'beginner', :fingerprint, :supersedesQuizId,
                            :status, 'Choose.', '문장', 'Explanation.'
                        )
                        RETURNING id
                        """.trimIndent(),
                    ).param("supersedesQuizId", supersedesQuizId)
            }

        return query
            .param("fingerprint", fingerprint)
            .param("status", status)
            .query(Long::class.java)
            .single()
    }

    private fun insertChoice(
        quizId: Long,
        correct: Boolean,
        sortOrder: Int,
    ): Long =
        jdbcClient
            .sql(
                """
                INSERT INTO quiz_choices (
                    quiz_question_id, choice_text, is_correct, sort_order
                ) VALUES (
                    :quizId, 'Choice', :correct, :sortOrder
                )
                RETURNING id
                """.trimIndent(),
            ).param("quizId", quizId)
            .param("correct", correct)
            .param("sortOrder", sortOrder)
            .query(Long::class.java)
            .single()
}
