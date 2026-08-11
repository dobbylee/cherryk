package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import kotlin.random.Random

data class QuizProgress(
    val solvedCount: Int,
    val totalCount: Int,
    val attemptCount: Int,
    val correctCount: Int,
)

data class QuizPracticeItem(
    val quiz: RecommendedQuiz,
    val attemptCount: Int,
)

data class QuizRecommendation(
    val quizzes: List<QuizPracticeItem>,
    val availableTags: List<GrammarTag>,
    val activeTags: List<GrammarTag>,
    val progress: QuizProgress,
)

fun interface QuizSelectionRandom {
    fun nextDouble(): Double
}

@Component
class DefaultQuizSelectionRandom : QuizSelectionRandom {
    override fun nextDouble(): Double = Random.nextDouble()
}

@Service
class QuizRecommendationService(
    private val repository: QuizReadRepository,
    private val random: QuizSelectionRandom,
) {
    fun recommend(
        userId: Long,
        tags: List<GrammarTag>?,
        quizType: QuizType = QuizType.GRAMMAR,
    ): QuizRecommendation {
        val requestedTags = (tags ?: repository.findTopUserTags(userId)).distinct()
        val approvedQuizzes = repository.findApprovedQuizzesByTags(quizType, emptySet())
        val availableTagSet = approvedQuizzes.map(RecommendedQuiz::tag).toSet()
        val availableTags = GrammarTag.entries.filter(availableTagSet::contains)
        val activeTags = requestedTags.filter(availableTagSet::contains)
        val matchingQuizzes = approvedQuizzes.filter { it.tag in activeTags }
        val candidates = matchingQuizzes.ifEmpty { approvedQuizzes }
        val candidateQuizIds = candidates.map(RecommendedQuiz::id).toSet()
        val candidateAttemptSummaries =
            repository.findAttemptSummaries(userId).filter { it.quizId in candidateQuizIds }
        val summariesByQuizId = candidateAttemptSummaries.associateBy(QuizAttemptSummary::quizId)

        return QuizRecommendation(
            quizzes = selectPracticeSet(candidates, summariesByQuizId),
            availableTags = availableTags,
            activeTags = if (matchingQuizzes.isEmpty()) emptyList() else activeTags,
            progress =
                QuizProgress(
                    solvedCount = candidateAttemptSummaries.size,
                    totalCount = candidates.size,
                    attemptCount = candidateAttemptSummaries.sumOf(QuizAttemptSummary::attemptCount),
                    correctCount = candidateAttemptSummaries.sumOf(QuizAttemptSummary::correctCount),
                ),
        )
    }

    private fun selectPracticeSet(
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
