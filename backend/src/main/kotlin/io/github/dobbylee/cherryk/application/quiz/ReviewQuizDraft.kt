package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import org.springframework.stereotype.Service
import java.time.Clock

@Service
class ReviewQuizDraft(
    private val commands: QuizCommandService,
    private val clock: Clock,
) {
    fun updateDraft(
        quizId: Long,
        update: AdminQuizUpdate,
    ): QuizCommandResult.Success {
        val result =
            try {
                commands.reviewDraft(
                    quizId = quizId,
                    update = update.contentUpdate(),
                    requestedStatus = update.status,
                    now = clock.instant(),
                )
            } catch (exception: QuizReviewRollbackException) {
                exception.failure
            } catch (exception: QuizDuplicateException) {
                throw AdminQuizApplicationException(
                    code = "quiz_duplicate",
                    message = "A quiz with the same content or learning target already exists.",
                )
            }

        return result.requireSuccess()
    }

    fun rejectDraft(quizId: Long): Long {
        return when (val result = commands.rejectDraft(quizId)) {
            is QuizCommandResult.Success -> result.quizId
            is QuizCommandResult.Failure ->
                throw AdminQuizApplicationException(
                    code = "quiz_not_found",
                    message = "Quiz draft was not found.",
                )
        }
    }

    private fun QuizCommandResult.requireSuccess(): QuizCommandResult.Success =
        when (this) {
            is QuizCommandResult.Success -> this
            is QuizCommandResult.Failure ->
                when (reason) {
                    QuizCommandFailure.NOT_FOUND ->
                        throw AdminQuizApplicationException(
                            code = "quiz_not_found",
                            message = "Quiz was not found.",
                        )
                    QuizCommandFailure.NOT_EDITABLE ->
                        throw AdminQuizApplicationException(
                            code = "quiz_not_editable",
                            message = "Quiz is not an editable draft.",
                        )
                    QuizCommandFailure.INVALID_REVISION_TARGET ->
                        throw AdminQuizApplicationException(
                            code = "quiz_revision_invalid",
                            message = "Quiz revision target is not available.",
                        )
                }
        }
}
