package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.quiz.QuizCommandFailure
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.application.quiz.QuizCommandStore
import io.github.dobbylee.cherryk.application.quiz.QuizDraftUpdate
import io.github.dobbylee.cherryk.application.quiz.QuizDuplicateException
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.learningTarget
import org.hibernate.exception.ConstraintViolationException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.Types
import java.time.Instant
import java.time.ZoneOffset

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
            lockContentIdentity(content)
            if (learningTargetExists(content)) {
                throw QuizDuplicateException()
            }
            persistDraft(content, now)
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
            ) || learningTargetExists(content)
        ) {
            return null
        }
        return persistDraft(content, now)
    }

    override fun prepareDraftBatch(contents: List<QuizContent>) {
        contents
            .flatMap { content ->
                listOf(
                    fingerprintLockKey(content.fingerprint()),
                    learningTargetLockKey(content),
                )
            }
            .distinct()
            .sorted()
            .forEach(::lockIdentity)
    }

    override fun findNovelDrafts(contents: List<QuizContent>): List<QuizContent> {
        val seenFingerprints = mutableSetOf<String>()
        val seenLearningTargets = mutableSetOf<String>()
        return contents.filter { content ->
            val fingerprint = content.fingerprint()
            val targetIdentity = learningTargetIdentity(content)
            seenFingerprints.add(fingerprint) &&
                seenLearningTargets.add(targetIdentity) &&
                !quizRepository.existsActiveByFingerprint(
                    fingerprint = fingerprint,
                    approvedStatus = QuizStatus.APPROVED,
                    draftStatus = QuizStatus.DRAFT,
                ) &&
                !learningTargetExists(content)
        }
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

            val currentContent = quiz.content()
            val updatedContent = update.applyTo(currentContent)
            val learningTargetChanged =
                learningTargetIdentity(currentContent) != learningTargetIdentity(updatedContent)
            val restoresSupersededTarget =
                quiz.supersedesQuizId
                    ?.let(quizRepository::findByIdForUpdate)
                    ?.content()
                    ?.let(::learningTargetIdentity) == learningTargetIdentity(updatedContent)
            if (learningTargetChanged && !restoresSupersededTarget) {
                lockIdentity(learningTargetLockKey(updatedContent))
                if (learningTargetExists(updatedContent, excludingQuizId = quiz.id)) {
                    throw QuizDuplicateException()
                }
            }
            val newCorrectSortOrder =
                updatedContent.choices.single(QuizChoiceContent::correct).sortOrder
            if (quiz.clearCorrectChoiceBeforeReplacement(newCorrectSortOrder)) {
                quizRepository.saveAndFlush(quiz)
            }
            quiz.editDraft(content = updatedContent, now = now)
            val saved = quizRepository.saveAndFlush(quiz)
            if (learningTargetChanged && !restoresSupersededTarget) {
                recordLearningTarget(saved, updatedContent, now)
            }
            success(saved)
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

    private fun persistDraft(
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
        recordLearningTarget(quiz, content, now)
        return success(quiz)
    }

    private fun lockContentIdentity(content: QuizContent) {
        listOf(
            fingerprintLockKey(content.fingerprint()),
            learningTargetLockKey(content),
        ).sorted().forEach(::lockIdentity)
    }

    private fun lockIdentity(identity: String) {
        jdbcClient
            .sql(
                """
                SELECT pg_advisory_xact_lock(hashtextextended(:identity, 0))
                """.trimIndent(),
            ).param("identity", identity)
            .query { _, _ -> true }
            .single()
    }

    private fun learningTargetExists(
        content: QuizContent,
        excludingQuizId: Long? = null,
    ): Boolean {
        val target = content.learningTarget()
        val query =
            jdbcClient
                .sql(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM quiz_learning_targets
                        WHERE quiz_type = :quizType
                          AND tag = :tag
                          AND target_digest = :targetDigest
                          AND (
                            :excludingQuizId IS NULL
                            OR quiz_question_id IS NULL
                            OR quiz_question_id <> :excludingQuizId
                          )
                    )
                    """.trimIndent(),
                ).param("quizType", content.quizType.databaseValue)
                .param("tag", content.tag.databaseValue)
                .param("targetDigest", target.digest)
        return if (excludingQuizId == null) {
            query.param("excludingQuizId", null, Types.BIGINT)
        } else {
            query.param("excludingQuizId", excludingQuizId)
        }.query(Boolean::class.java).single()
    }

    private fun recordLearningTarget(
        quiz: QuizEntity,
        content: QuizContent,
        now: Instant,
    ) {
        val target = content.learningTarget()
        val inserted =
            jdbcClient
                .sql(
                    """
                    INSERT INTO quiz_learning_targets (
                        quiz_question_id, quiz_type, tag, target_key, target_digest, created_at
                    ) VALUES (
                        :quizId, :quizType, :tag, :targetKey, :targetDigest, :createdAt
                    )
                    ON CONFLICT (quiz_type, tag, target_digest) DO NOTHING
                    """.trimIndent(),
                ).param("quizId", quiz.id)
                .param("quizType", content.quizType.databaseValue)
                .param("tag", content.tag.databaseValue)
                .param("targetKey", target.key)
                .param("targetDigest", target.digest)
                .param("createdAt", now.atOffset(ZoneOffset.UTC))
                .update()
        if (inserted == 0 && !learningTargetOwnedByQuiz(content, quiz.id)) {
            throw QuizDuplicateException()
        }
    }

    private fun learningTargetOwnedByQuiz(
        content: QuizContent,
        quizId: Long,
    ): Boolean =
        jdbcClient
            .sql(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM quiz_learning_targets
                    WHERE quiz_type = :quizType
                      AND tag = :tag
                      AND target_digest = :targetDigest
                      AND quiz_question_id = :quizId
                )
                """.trimIndent(),
            ).param("quizType", content.quizType.databaseValue)
            .param("tag", content.tag.databaseValue)
            .param("targetDigest", content.learningTarget().digest)
            .param("quizId", quizId)
            .query(Boolean::class.java)
            .single()

    private fun fingerprintLockKey(fingerprint: String): String = "fingerprint:$fingerprint"

    private fun learningTargetLockKey(content: QuizContent): String =
        "learning-target:${learningTargetIdentity(content)}"

    private fun learningTargetIdentity(content: QuizContent): String =
        listOf(
            content.quizType.databaseValue,
            content.tag.databaseValue,
            content.learningTarget().digest,
        ).joinToString("\u001f")

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
    generateSequence<Throwable>(this) { it.cause }.any { cause ->
        val constraintName =
            when (cause) {
                is ConstraintViolationException -> cause.constraintName
                else -> QUIZ_DUPLICATE_CONSTRAINTS.firstOrNull { constraint ->
                    cause.message?.contains(constraint) == true
                }
            }
        constraintName in QUIZ_DUPLICATE_CONSTRAINTS
    }

private val QUIZ_DUPLICATE_CONSTRAINTS =
    setOf(
        "quiz_questions_active_fingerprint_unique",
        "quiz_questions_revision_target_unique",
        "quiz_learning_targets_identity_unique",
    )
