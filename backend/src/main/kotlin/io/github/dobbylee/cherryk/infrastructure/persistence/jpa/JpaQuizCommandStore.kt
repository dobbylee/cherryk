package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.quiz.QuizCommandFailure
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.application.quiz.QuizCommandStore
import io.github.dobbylee.cherryk.application.quiz.QuizDraftUpdate
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class JpaQuizCommandStore(
    private val quizRepository: QuizJpaRepository,
) : QuizCommandStore {
    override fun createDraft(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success {
        val quiz =
            quizRepository.saveAndFlush(
                QuizEntity.createDraft(
                    content = content,
                    now = now,
                ),
            )
        return success(quiz)
    }

    override fun createRevision(
        approvedQuizId: Long,
        now: Instant,
    ): QuizCommandResult {
        val approvedQuiz =
            quizRepository.findByIdForUpdate(approvedQuizId)
                ?: return failure(QuizCommandFailure.NOT_FOUND)
        if (approvedQuiz.status != QuizStatus.APPROVED) {
            return failure(QuizCommandFailure.INVALID_REVISION_TARGET)
        }

        val revision =
            quizRepository.saveAndFlush(
                QuizEntity.createDraft(
                    content = approvedQuiz.content(),
                    supersedesQuizId = approvedQuiz.id,
                    source = approvedQuiz.source,
                    now = now,
                ),
            )
        return success(revision)
    }

    override fun updateDraft(
        quizId: Long,
        update: QuizDraftUpdate,
        now: Instant,
    ): QuizCommandResult {
        val quiz =
            quizRepository.findByIdForUpdate(quizId)
                ?: return failure(QuizCommandFailure.NOT_FOUND)
        if (quiz.status != QuizStatus.DRAFT) {
            return failure(QuizCommandFailure.NOT_EDITABLE)
        }

        quiz.editDraft(
            content = update.applyTo(quiz.content()),
            now = now,
        )
        return success(quizRepository.saveAndFlush(quiz))
    }

    override fun approveDraft(
        quizId: Long,
        now: Instant,
    ): QuizCommandResult {
        val quiz =
            quizRepository.findByIdForUpdate(quizId)
                ?: return failure(QuizCommandFailure.NOT_FOUND)
        if (quiz.status != QuizStatus.DRAFT) {
            return failure(QuizCommandFailure.NOT_EDITABLE)
        }

        quiz.supersedesQuizId?.let { supersededId ->
            val superseded =
                quizRepository.findByIdForUpdate(supersededId)
                    ?: return failure(QuizCommandFailure.INVALID_REVISION_TARGET)
            if (superseded.status != QuizStatus.APPROVED) {
                return failure(QuizCommandFailure.INVALID_REVISION_TARGET)
            }
            superseded.retire(now)
            quizRepository.saveAndFlush(superseded)
        }

        quiz.approve(now)
        return success(quizRepository.saveAndFlush(quiz))
    }

    override fun rejectDraft(quizId: Long): QuizCommandResult {
        val quiz =
            quizRepository.findByIdForUpdate(quizId)
                ?: return failure(QuizCommandFailure.NOT_FOUND)
        if (quiz.status != QuizStatus.DRAFT) {
            return failure(QuizCommandFailure.NOT_EDITABLE)
        }

        quizRepository.delete(quiz)
        quizRepository.flush()
        return success(quiz)
    }

    private fun success(quiz: QuizEntity) =
        QuizCommandResult.Success(
            quizId = quiz.id,
            status = quiz.status,
        )

    private fun failure(reason: QuizCommandFailure) = QuizCommandResult.Failure(reason)
}
