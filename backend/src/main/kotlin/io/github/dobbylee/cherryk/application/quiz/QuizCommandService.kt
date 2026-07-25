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

    fun rejectDraft(quizId: Long): QuizCommandResult
}

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
    fun rejectDraft(quizId: Long): QuizCommandResult = store.rejectDraft(quizId)
}
