package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import java.time.Instant
import java.util.UUID

interface QuizReadRepository {
    fun findApprovedQuizzesByTags(tags: Set<GrammarTag>): List<RecommendedQuiz>

    fun findAttemptSummaries(userId: UUID): List<QuizAttemptSummary>

    fun findTopUserTags(userId: UUID): List<GrammarTag>
}

data class RecommendedQuiz(
    val id: UUID,
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val questionEn: String,
    val sentenceKo: String,
    val choices: List<RecommendedQuizChoice>,
)

data class RecommendedQuizChoice(
    val id: UUID,
    val text: String,
)

data class QuizAttemptSummary(
    val quizId: UUID,
    val attemptCount: Int,
    val correctCount: Int,
    val lastAttemptCorrect: Boolean,
    val lastAttemptedAt: Instant,
)
