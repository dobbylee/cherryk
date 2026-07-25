package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.quiz.QuizCommandFailure
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.application.quiz.QuizCommandStore
import io.github.dobbylee.cherryk.application.quiz.QuizDraftUpdate
import io.github.dobbylee.cherryk.application.quiz.QuizDuplicateException
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import org.hibernate.exception.ConstraintViolationException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class JpaQuizCommandStore(
    private val quizRepository: QuizJpaRepository,
    private val jdbcClient: JdbcClient,
) : QuizCommandStore {
    override fun createDraft(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success =
        translateDuplicate {
            val quiz =
                quizRepository.saveAndFlush(
                    QuizEntity.createDraft(
                        content = content,
                        now = now,
                    ),
                )
            success(quiz)
        }

    override fun createDraftIfAbsent(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success? {
        val fingerprint = content.fingerprint()
        if (
            quizRepository.existsActiveByFingerprint(
                fingerprint = fingerprint,
                approvedStatus = QuizStatus.APPROVED,
                draftStatus = QuizStatus.DRAFT,
            )
        ) {
            return null
        }
        return createDraft(content, now)
    }

    override fun prepareDraftBatch(contents: List<QuizContent>) {
        contents
            .map(QuizContent::fingerprint)
            .distinct()
            .sorted()
            .forEach(::lockFingerprint)
    }

    override fun createRevision(
        approvedQuizId: Long,
        now: Instant,
    ): QuizCommandResult =
        translateDuplicate {
            val approvedQuiz =
                quizRepository.findByIdForUpdate(approvedQuizId)
                    ?: return@translateDuplicate failure(QuizCommandFailure.NOT_FOUND)
            if (approvedQuiz.status != QuizStatus.APPROVED) {
                return@translateDuplicate failure(QuizCommandFailure.INVALID_REVISION_TARGET)
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
            success(revision)
        }

    override fun updateDraft(
        quizId: Long,
        update: QuizDraftUpdate,
        now: Instant,
    ): QuizCommandResult =
        translateDuplicate {
            val quiz =
                quizRepository.findByIdForUpdate(quizId)
                    ?: return@translateDuplicate failure(QuizCommandFailure.NOT_FOUND)
            if (quiz.status != QuizStatus.DRAFT) {
                return@translateDuplicate failure(QuizCommandFailure.NOT_EDITABLE)
            }

            val updatedContent = update.applyTo(quiz.content())
            val newCorrectSortOrder =
                updatedContent.choices.single(QuizChoiceContent::correct).sortOrder
            if (quiz.clearCorrectChoiceBeforeReplacement(newCorrectSortOrder)) {
                quizRepository.saveAndFlush(quiz)
            }
            quiz.editDraft(content = updatedContent, now = now)
            success(quizRepository.saveAndFlush(quiz))
        }

    override fun approveDraft(
        quizId: Long,
        now: Instant,
    ): QuizCommandResult =
        translateDuplicate {
            val quiz =
                quizRepository.findByIdForUpdate(quizId)
                    ?: return@translateDuplicate failure(QuizCommandFailure.NOT_FOUND)
            if (quiz.status != QuizStatus.DRAFT) {
                return@translateDuplicate failure(QuizCommandFailure.NOT_EDITABLE)
            }

            quiz.supersedesQuizId?.let { supersededId ->
                val superseded =
                    quizRepository.findByIdForUpdate(supersededId)
                        ?: return@translateDuplicate failure(QuizCommandFailure.INVALID_REVISION_TARGET)
                if (superseded.status != QuizStatus.APPROVED) {
                    return@translateDuplicate failure(QuizCommandFailure.INVALID_REVISION_TARGET)
                }
                superseded.retire(now)
                quizRepository.saveAndFlush(superseded)
            }

            quiz.approve(now)
            success(quizRepository.saveAndFlush(quiz))
        }

    override fun confirmDraft(quizId: Long): QuizCommandResult {
        val quiz =
            quizRepository.findByIdForUpdate(quizId)
                ?: return failure(QuizCommandFailure.NOT_FOUND)
        return if (quiz.status == QuizStatus.DRAFT) {
            success(quiz)
        } else {
            failure(QuizCommandFailure.NOT_EDITABLE)
        }
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

    private fun lockFingerprint(fingerprint: String) {
        jdbcClient
            .sql(
                """
                SELECT pg_advisory_xact_lock(hashtextextended(:fingerprint, 0))
                """.trimIndent(),
            ).param("fingerprint", fingerprint)
            .query { _, _ -> true }
            .single()
    }

    private fun <T> translateDuplicate(block: () -> T): T =
        try {
            block()
        } catch (exception: DataIntegrityViolationException) {
            if (exception.isQuizDuplicate()) {
                throw QuizDuplicateException()
            }
            throw exception
        }
}

private fun DataIntegrityViolationException.isQuizDuplicate(): Boolean =
    generateSequence<Throwable>(this) { it.cause }
        .filterIsInstance<ConstraintViolationException>()
        .mapNotNull(ConstraintViolationException::getConstraintName)
        .any(QUIZ_DUPLICATE_CONSTRAINTS::contains)

private val QUIZ_DUPLICATE_CONSTRAINTS =
    setOf(
        "quiz_questions_active_fingerprint_unique",
        "quiz_questions_revision_target_unique",
    )
