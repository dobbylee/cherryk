package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.stereotype.Service
import java.time.Clock

data class AdminQuizDraftRequest(
    val quizType: QuizType,
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val count: Int,
    val instruction: String?,
)

data class AdminQuizDraft(
    val id: Long,
    val content: QuizContent,
)

data class AdminQuizUpdate(
    val tag: GrammarTag? = null,
    val difficulty: UserLevel? = null,
    val questionEn: String? = null,
    val sentenceKo: String? = null,
    val choices: List<QuizChoiceContent>? = null,
    val answerExplanationEn: String? = null,
    val status: QuizStatus? = null,
) {
    fun contentUpdate(): QuizDraftUpdate? =
        if (
            tag == null &&
            difficulty == null &&
            questionEn == null &&
            sentenceKo == null &&
            choices == null &&
            answerExplanationEn == null
        ) {
            null
        } else {
            QuizDraftUpdate(
                tag = tag,
                difficulty = difficulty,
                questionEn = questionEn,
                sentenceKo = sentenceKo,
                choices = choices,
                answerExplanationEn = answerExplanationEn,
            )
        }
}

class AdminQuizApplicationException(
    val code: String,
    message: String,
) : RuntimeException(message)

@Service
class AdminQuizApplicationService(
    private val provider: QuizDraftProvider,
    private val commands: QuizCommandService,
    private val clock: Clock,
) {
    fun generateDrafts(request: AdminQuizDraftRequest): List<AdminQuizDraft> {
        val contents =
            try {
                provider.generate(
                    QuizDraftProviderInput(
                        quizType = request.quizType,
                        tag = request.tag,
                        difficulty = request.difficulty,
                        count = request.count,
                        instruction = request.instruction,
                    ),
                )
            } catch (exception: QuizDraftProviderException) {
                if (exception.code == "invalid_response") {
                    throw AdminQuizApplicationException(
                        code = "invalid_ai_output",
                        message = "AI quiz draft output is invalid.",
                    )
                }
                throw exception
        }
        val now = clock.instant()

        return commands.createDrafts(contents, now).map { created ->
            AdminQuizDraft(
                id = created.result.quizId,
                content = created.content,
            )
        }
    }

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
                    message = "An identical quiz already exists.",
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
