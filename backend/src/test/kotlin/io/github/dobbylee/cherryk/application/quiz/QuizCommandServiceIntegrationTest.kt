package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs

@SpringBootTest
class QuizCommandServiceIntegrationTest(
    @Autowired private val service: QuizCommandService,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `creates edits and approves a complete standalone draft`() {
        val ids = mutableListOf<Long>()
        try {
            val created = service.createDraft(content(), NOW)
            ids += created.quizId

            val updated =
                service.updateDraft(
                    quizId = created.quizId,
                    update = QuizDraftUpdate(questionEn = "Choose the best particle."),
                    now = NOW.plusSeconds(1),
                )
            val approved = service.approveDraft(created.quizId, NOW.plusSeconds(2))

            assertEquals(QuizStatus.DRAFT, assertIs<QuizCommandResult.Success>(updated).status)
            assertEquals(QuizStatus.APPROVED, assertIs<QuizCommandResult.Success>(approved).status)
            assertEquals(
                StoredQuiz(
                    status = "approved",
                    questionEn = "Choose the best particle.",
                    supersedesQuizId = null,
                ),
                findQuiz(created.quizId),
            )
            assertEquals(4, choiceCount(created.quizId))
        } finally {
            deleteQuizzes(ids)
        }
    }

    @Test
    fun `approved content cannot be edited or rejected`() {
        val ids = mutableListOf<Long>()
        try {
            val originalContent = content()
            val created = service.createDraft(originalContent, NOW)
            ids += created.quizId
            service.approveDraft(created.quizId, NOW.plusSeconds(1))

            assertEquals(
                QuizCommandResult.Failure(QuizCommandFailure.NOT_EDITABLE),
                service.updateDraft(
                    quizId = created.quizId,
                    update = QuizDraftUpdate(sentenceKo = "바뀌면 안 되는 문장"),
                    now = NOW.plusSeconds(2),
                ),
            )
            assertEquals(
                QuizCommandResult.Failure(QuizCommandFailure.NOT_EDITABLE),
                service.rejectDraft(created.quizId),
            )
            assertEquals(originalContent.sentenceKo, sentence(created.quizId))
        } finally {
            deleteQuizzes(ids)
        }
    }

    @Test
    fun `approving a revision retires its prior approved quiz atomically`() {
        val ids = mutableListOf<Long>()
        try {
            val original = service.createDraft(content(), NOW)
            ids += original.quizId
            service.approveDraft(original.quizId, NOW.plusSeconds(1))
            val revision =
                assertIs<QuizCommandResult.Success>(
                    service.createRevision(original.quizId, NOW.plusSeconds(2)),
                )
            ids += revision.quizId
            service.updateDraft(
                quizId = revision.quizId,
                update = QuizDraftUpdate(questionEn = "Choose the revised answer."),
                now = NOW.plusSeconds(3),
            )

            val approved = service.approveDraft(revision.quizId, NOW.plusSeconds(4))

            assertEquals(QuizStatus.APPROVED, assertIs<QuizCommandResult.Success>(approved).status)
            assertEquals("retired", findQuiz(original.quizId).status)
            assertEquals(
                StoredQuiz(
                    status = "approved",
                    questionEn = "Choose the revised answer.",
                    supersedesQuizId = original.quizId,
                ),
                findQuiz(revision.quizId),
            )
        } finally {
            deleteQuizzes(ids)
        }
    }

    @Test
    fun `failed revision approval restores the prior approved quiz`() {
        val ids = mutableListOf<Long>()
        try {
            val original = service.createDraft(content("original"), NOW)
            ids += original.quizId
            service.approveDraft(original.quizId, NOW.plusSeconds(1))

            val duplicate = service.createDraft(content("duplicate"), NOW.plusSeconds(2))
            ids += duplicate.quizId
            service.approveDraft(duplicate.quizId, NOW.plusSeconds(3))

            val revision =
                assertIs<QuizCommandResult.Success>(
                    service.createRevision(original.quizId, NOW.plusSeconds(4)),
                )
            ids += revision.quizId
            service.updateDraft(
                quizId = revision.quizId,
                update =
                    QuizDraftUpdate(
                        tag = duplicateContent().tag,
                        difficulty = duplicateContent().difficulty,
                        sentenceKo = duplicateContent().sentenceKo,
                        choices = duplicateContent().choices,
                    ),
                now = NOW.plusSeconds(5),
            )

            assertFailsWith<DataIntegrityViolationException> {
                service.approveDraft(revision.quizId, NOW.plusSeconds(6))
            }

            assertEquals("approved", findQuiz(original.quizId).status)
            assertEquals("draft", findQuiz(revision.quizId).status)
            assertEquals("approved", findQuiz(duplicate.quizId).status)
        } finally {
            deleteQuizzes(ids)
        }
    }

    @Test
    fun `revision target must still be approved`() {
        val ids = mutableListOf<Long>()
        try {
            val draft = service.createDraft(content(), NOW)
            ids += draft.quizId

            assertEquals(
                QuizCommandResult.Failure(QuizCommandFailure.INVALID_REVISION_TARGET),
                service.createRevision(draft.quizId, NOW.plusSeconds(1)),
            )
        } finally {
            deleteQuizzes(ids)
        }
    }

    private fun content(marker: String = UUID.randomUUID().toString()) =
        QuizContent(
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            questionEn = "Choose the correct particle.",
            sentenceKo = "저는 물($marker) 마셔요.",
            choices =
                listOf(
                    QuizChoiceContent("은-$marker", false, 0),
                    QuizChoiceContent("을-$marker", true, 1),
                    QuizChoiceContent("에-$marker", false, 2),
                    QuizChoiceContent("이-$marker", false, 3),
                ),
            answerExplanationEn = "Use 을.",
        )

    private fun duplicateContent() = content("duplicate")

    private fun findQuiz(id: Long): StoredQuiz =
        jdbcClient
            .sql(
                """
                SELECT status, question_en, supersedes_quiz_id
                FROM quiz_questions
                WHERE id = :id
                """.trimIndent(),
            ).param("id", id)
            .query { resultSet, _ ->
                StoredQuiz(
                    status = resultSet.getString("status"),
                    questionEn = resultSet.getString("question_en"),
                    supersedesQuizId =
                        resultSet.getLong("supersedes_quiz_id").let { value ->
                            if (resultSet.wasNull()) null else value
                        },
                )
            }.single()

    private fun choiceCount(id: Long): Int =
        jdbcClient
            .sql("SELECT count(*) FROM quiz_choices WHERE quiz_question_id = :id")
            .param("id", id)
            .query(Int::class.java)
            .single()

    private fun sentence(id: Long): String =
        jdbcClient
            .sql("SELECT sentence_ko FROM quiz_questions WHERE id = :id")
            .param("id", id)
            .query(String::class.java)
            .single()

    private fun deleteQuizzes(ids: List<Long>) {
        ids.asReversed().forEach { id ->
            jdbcClient
                .sql("DELETE FROM quiz_questions WHERE id = :id")
                .param("id", id)
                .update()
        }
    }

    private companion object {
        val NOW: Instant = Instant.parse("2026-07-25T05:00:00Z")
    }
}

private data class StoredQuiz(
    val status: String,
    val questionEn: String,
    val supersedesQuizId: Long?,
)
