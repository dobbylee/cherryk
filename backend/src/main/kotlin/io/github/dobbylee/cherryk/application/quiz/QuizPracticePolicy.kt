package io.github.dobbylee.cherryk.application.quiz

internal class QuizPracticePolicy(
    private val random: QuizSelectionRandom,
) {
    fun select(
        quizzes: List<RecommendedQuiz>,
        summariesByQuizId: Map<Long, QuizAttemptSummary>,
    ): List<QuizPracticeItem> =
        quizzes
            .map { quiz ->
                PracticeCandidate(
                    quiz = quiz,
                    summary = summariesByQuizId[quiz.id],
                    randomOrder = random.nextDouble(),
                )
            }.sortedWith(PRACTICE_CANDIDATE_COMPARATOR)
            .take(PRACTICE_SET_SIZE)
            .map { candidate ->
                QuizPracticeItem(
                    quiz = candidate.quiz,
                    attemptCount = candidate.summary?.attemptCount ?: 0,
                )
            }

    fun progress(
        candidates: List<RecommendedQuiz>,
        summaries: List<QuizAttemptSummary>,
    ): QuizProgress =
        QuizProgress(
            solvedCount = summaries.size,
            totalCount = candidates.size,
            attemptCount = summaries.sumOf(QuizAttemptSummary::attemptCount),
            correctCount = summaries.sumOf(QuizAttemptSummary::correctCount),
        )
}

private data class PracticeCandidate(
    val quiz: RecommendedQuiz,
    val summary: QuizAttemptSummary?,
    val randomOrder: Double,
)

private val PRACTICE_CANDIDATE_COMPARATOR =
    Comparator<PracticeCandidate> { left, right ->
        when {
            left.summary == null && right.summary == null ->
                left.randomOrder.compareTo(right.randomOrder)
            left.summary == null -> -1
            right.summary == null -> 1
            left.summary.lastAttemptCorrect != right.summary.lastAttemptCorrect ->
                left.summary.lastAttemptCorrect.compareTo(right.summary.lastAttemptCorrect)
            else -> {
                val accuracyComparison =
                    left.summary.correctCount.toLong() * right.summary.attemptCount -
                        right.summary.correctCount.toLong() * left.summary.attemptCount
                when {
                    accuracyComparison != 0L -> accuracyComparison.compareTo(0L)
                    left.summary.attemptCount != right.summary.attemptCount ->
                        left.summary.attemptCount.compareTo(right.summary.attemptCount)
                    left.summary.lastAttemptedAt != right.summary.lastAttemptedAt ->
                        left.summary.lastAttemptedAt.compareTo(right.summary.lastAttemptedAt)
                    else -> left.randomOrder.compareTo(right.randomOrder)
                }
            }
        }
    }

private const val PRACTICE_SET_SIZE = 5
