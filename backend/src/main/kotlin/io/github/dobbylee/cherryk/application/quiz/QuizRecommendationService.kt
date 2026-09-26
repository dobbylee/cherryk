package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.learning.api.TopLearningTags
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
    private val learningTags: TopLearningTags,
    random: QuizSelectionRandom,
) {
    private val policy = QuizPracticePolicy(random)

    fun recommend(
        userId: Long,
        tags: List<GrammarTag>?,
        quizType: QuizType = QuizType.GRAMMAR,
    ): QuizRecommendation {
        val requestedTags = (tags ?: learningTags.findTopTags(userId)).distinct()
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
            quizzes = policy.select(candidates, summariesByQuizId),
            availableTags = availableTags,
            activeTags = if (matchingQuizzes.isEmpty()) emptyList() else activeTags,
            progress = policy.progress(candidates, candidateAttemptSummaries),
        )
    }
}
