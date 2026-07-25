package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

data class QuizDraftUpdate(
    val tag: GrammarTag? = null,
    val difficulty: UserLevel? = null,
    val questionEn: String? = null,
    val sentenceKo: String? = null,
    val choices: List<QuizChoiceContent>? = null,
    val answerExplanationEn: String? = null,
) {
    init {
        require(
            tag != null ||
                difficulty != null ||
                questionEn != null ||
                sentenceKo != null ||
                choices != null ||
                answerExplanationEn != null,
        ) {
            "Quiz draft update must include at least one change."
        }
    }

    fun applyTo(content: QuizContent): QuizContent =
        QuizContent(
            tag = tag ?: content.tag,
            difficulty = difficulty ?: content.difficulty,
            questionEn = questionEn ?: content.questionEn,
            sentenceKo = sentenceKo ?: content.sentenceKo,
            choices = choices ?: content.choices,
            answerExplanationEn = answerExplanationEn ?: content.answerExplanationEn,
        )
}

enum class QuizCommandFailure {
    NOT_FOUND,
    NOT_EDITABLE,
    INVALID_REVISION_TARGET,
}

sealed interface QuizCommandResult {
    data class Success(
        val quizId: Long,
        val status: QuizStatus,
    ) : QuizCommandResult

    data class Failure(
        val reason: QuizCommandFailure,
    ) : QuizCommandResult
}

interface QuizCommandStore {
    fun createDraft(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success

    fun createDraftIfAbsent(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success?

    fun prepareDraftBatch(contents: List<QuizContent>)

    fun createRevision(
        approvedQuizId: Long,
        now: Instant,
    ): QuizCommandResult

    fun updateDraft(
        quizId: Long,
        update: QuizDraftUpdate,
        now: Instant,
    ): QuizCommandResult

    fun approveDraft(
        quizId: Long,
        now: Instant,
    ): QuizCommandResult

    fun confirmDraft(quizId: Long): QuizCommandResult

    fun rejectDraft(quizId: Long): QuizCommandResult
}

class QuizDuplicateException : RuntimeException("An identical quiz already exists.")

data class CreatedQuizDraft(
    val content: QuizContent,
    val result: QuizCommandResult.Success,
)

internal class QuizReviewRollbackException(
    val failure: QuizCommandResult.Failure,
) : RuntimeException("Quiz review transaction was rejected.")

@Service
class QuizCommandService(
    private val store: QuizCommandStore,
) {
    @Transactional
    fun createDraft(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success = store.createDraft(content, now)

    @Transactional
    fun createDrafts(
        contents: List<QuizContent>,
        now: Instant,
    ): List<CreatedQuizDraft> {
        store.prepareDraftBatch(contents)
        return contents.mapNotNull { content ->
            store.createDraftIfAbsent(content, now)?.let { created ->
                CreatedQuizDraft(content = content, result = created)
            }
        }
    }

    @Transactional
    fun createRevision(
        approvedQuizId: Long,
        now: Instant,
    ): QuizCommandResult = store.createRevision(approvedQuizId, now)

    @Transactional
    fun updateDraft(
        quizId: Long,
        update: QuizDraftUpdate,
        now: Instant,
    ): QuizCommandResult = store.updateDraft(quizId, update, now)

    @Transactional
    fun approveDraft(
        quizId: Long,
        now: Instant,
    ): QuizCommandResult = store.approveDraft(quizId, now)

    @Transactional
    fun reviewDraft(
        quizId: Long,
        update: QuizDraftUpdate?,
        requestedStatus: QuizStatus?,
        now: Instant,
    ): QuizCommandResult {
        val reviewed =
            update
                ?.let { store.updateDraft(quizId, it, now) }
                ?: store.confirmDraft(quizId)
        if (reviewed is QuizCommandResult.Failure) {
            return reviewed
        }
        if (requestedStatus != QuizStatus.APPROVED) {
            return reviewed
        }

        return when (val approved = store.approveDraft(quizId, now)) {
            is QuizCommandResult.Success -> approved
            is QuizCommandResult.Failure -> throw QuizReviewRollbackException(approved)
        }
    }

    @Transactional
    fun rejectDraft(quizId: Long): QuizCommandResult = store.rejectDraft(quizId)
}
