package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.quiz.QuizAttemptFailure
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptInput
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptResult
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptStore
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptSuccess
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class JpaQuizAttemptStore(
    private val quizRepository: QuizJpaRepository,
    private val attemptRepository: QuizAttemptJpaRepository,
) : QuizAttemptStore {
    override fun record(
        input: QuizAttemptInput,
        now: Instant,
    ): QuizAttemptResult {
        val quiz =
            quizRepository.findByIdForUpdate(input.quizId)
                ?: return failure(QuizAttemptFailure.QUIZ_NOT_AVAILABLE)
        if (quiz.status != QuizStatus.APPROVED) {
            return failure(QuizAttemptFailure.QUIZ_NOT_AVAILABLE)
        }
        val selectedChoice =
            quiz.choices.singleOrNull { it.id == input.selectedChoiceId }
                ?: return failure(QuizAttemptFailure.INVALID_CHOICE)
        val correctChoice =
            quiz.choices.singleOrNull { it.correct }
                ?: throw IllegalStateException("Approved quiz must have exactly one correct choice.")

        attemptRepository.saveAndFlush(
            QuizAttemptEntity(
                userId = input.userId,
                quizQuestionId = quiz.id,
                selectedChoiceId = selectedChoice.id,
                correct = selectedChoice.correct,
                createdAt = now,
            ),
        )
        return QuizAttemptResult.Success(
            QuizAttemptSuccess(
                correct = selectedChoice.correct,
                correctChoiceId = correctChoice.id,
                explanationEn = quiz.answerExplanationEn,
            ),
        )
    }

    private fun failure(reason: QuizAttemptFailure) = QuizAttemptResult.Failure(reason)
}
