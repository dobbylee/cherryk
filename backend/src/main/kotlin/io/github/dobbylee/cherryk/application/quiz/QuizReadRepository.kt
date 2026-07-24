package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import java.time.Instant

interface QuizReadRepository {
    fun findApprovedQuizzesByTags(tags: Set<GrammarTag>): List<RecommendedQuiz>

    fun findAttemptSummaries(userId: Long): List<QuizAttemptSummary>

    fun findTopUserTags(userId: Long): List<GrammarTag>
}

data class RecommendedQuiz(
    val id: Long,
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val questionEn: String,
    val sentenceKo: String,
    val choices: List<RecommendedQuizChoice>,
)

data class RecommendedQuizChoice(
    val id: Long,
    val text: String,
)

data class QuizAttemptSummary(
    val quizId: Long,
    val attemptCount: Int,
    val correctCount: Int,
    val lastAttemptCorrect: Boolean,
    val lastAttemptedAt: Instant,
)
