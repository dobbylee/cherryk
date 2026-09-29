package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.learning.api.LearningActivityRecorder
import io.github.dobbylee.cherryk.learning.api.LearningActivitySource
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

data class QuizAttemptInput(
    val userId: Long,
    val quizId: Long,
    val selectedChoiceId: Long,
)

data class QuizAttemptSuccess(
    val attemptId: Long,
    val correct: Boolean,
    val correctChoiceId: Long,
    val explanationEn: String,
)

enum class QuizAttemptFailure {
    QUIZ_NOT_AVAILABLE,
    INVALID_CHOICE,
}

sealed interface QuizAttemptResult {
    data class Success(
        val value: QuizAttemptSuccess,
    ) : QuizAttemptResult

    data class Failure(
        val reason: QuizAttemptFailure,
    ) : QuizAttemptResult
}

interface QuizAttemptStore {
    fun record(
        input: QuizAttemptInput,
        now: Instant,
    ): QuizAttemptResult
}

@Service
class QuizAttemptService(
    private val store: QuizAttemptStore,
    private val clock: Clock,
    private val activityRecorder: LearningActivityRecorder,
) {
    @Transactional
    fun submit(input: QuizAttemptInput): QuizAttemptResult {
        val now = clock.instant()
        val result = store.record(input, now)
        if (result is QuizAttemptResult.Success) {
            activityRecorder.record(input.userId, LearningActivitySource.QUIZ_ATTEMPT, result.value.attemptId, now)
        }
        return result
    }
}
