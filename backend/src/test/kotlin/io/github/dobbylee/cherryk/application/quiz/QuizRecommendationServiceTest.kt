package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals

class QuizRecommendationServiceTest {
    @Test
    fun `selects at most five unseen quizzes before attempted quizzes`() {
        val quizzes = (1L..7L).map(::quiz)
        val repository =
            FakeQuizReadRepository(
                quizzes = quizzes,
                summaries =
                    listOf(
                        summary(quizzes[0].id, attemptCount = 2),
                        summary(quizzes[1].id, attemptCount = 2),
                    ),
            )
        val randomValues = ArrayDeque(listOf(0.9, 0.8, 0.5, 0.1, 0.4, 0.2, 0.3))
        val service =
            QuizRecommendationService(
                repository = repository,
                random = QuizSelectionRandom { randomValues.removeFirst() },
            )

        val result = service.recommend(userId = 1, tags = emptyList())

        assertEquals(listOf(4L, 6L, 7L, 5L, 3L), result.quizzes.map { it.quiz.id })
        assertEquals(listOf(0, 0, 0, 0, 0), result.quizzes.map(QuizPracticeItem::attemptCount))
    }

    @Test
    fun `orders review by recent error accuracy attempts and age and reports approved progress`() {
        val quizzes = (1L..6L).map(::quiz)
        val retiredSummary = summary(999, attemptCount = 10, correctCount = 10)
        val repository =
            FakeQuizReadRepository(
                quizzes = quizzes,
                topTags = listOf(GrammarTag.PARTICLE_OBJECT),
                summaries =
                    listOf(
                        summary(1, 4, 1, lastCorrect = true),
                        summary(2, 4, 1),
                        summary(3, 3, 1),
                        summary(4, 6, 2),
                        summary(5, 3, 1, attemptedAt = Instant.parse("2026-07-18T00:00:00Z")),
                        summary(6, 3, 1, attemptedAt = Instant.parse("2026-07-19T00:00:00Z")),
                        retiredSummary,
                    ),
            )
        val service = QuizRecommendationService(repository, QuizSelectionRandom { 0.5 })

        val result = service.recommend(userId = 1, tags = null)

        assertEquals(listOf(2L, 5L, 6L, 3L, 4L), result.quizzes.map { it.quiz.id })
        assertEquals(listOf(GrammarTag.PARTICLE_OBJECT), result.availableTags)
        assertEquals(listOf(GrammarTag.PARTICLE_OBJECT), result.activeTags)
        assertEquals(
            QuizProgress(
                solvedCount = 6,
                totalCount = 6,
                attemptCount = 23,
                correctCount = 7,
            ),
            result.progress,
        )
    }

    private fun quiz(id: Long) =
        RecommendedQuiz(
            id = id,
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            questionEn = "Question $id",
            sentenceKo = "문장 $id",
            choices =
                (1L..4L).map { choice ->
                    RecommendedQuizChoice(id = id * 10 + choice, text = "Choice $choice")
                },
        )

    private fun summary(
        quizId: Long,
        attemptCount: Int = 1,
        correctCount: Int = 0,
        lastCorrect: Boolean = false,
        attemptedAt: Instant = Instant.parse("2026-07-20T00:00:00Z"),
    ) = QuizAttemptSummary(
        quizId = quizId,
        attemptCount = attemptCount,
        correctCount = correctCount,
        lastAttemptCorrect = lastCorrect,
        lastAttemptedAt = attemptedAt,
    )
}

private class FakeQuizReadRepository(
    private val quizzes: List<RecommendedQuiz>,
    private val summaries: List<QuizAttemptSummary>,
    private val topTags: List<GrammarTag> = emptyList(),
) : QuizReadRepository {
    override fun findApprovedQuizzesByTags(tags: Set<GrammarTag>) = quizzes

    override fun findAttemptSummaries(userId: Long) = summaries

    override fun findTopUserTags(userId: Long) = topTags
}
