package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.AdminQuizDraft
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent

data class AdminQuizDraftGenerationResponse(
    val drafts: List<AdminQuizDraftResponse>,
)

data class AdminQuizDraftResponse(
    val id: String,
    val tag: String,
    val difficulty: String,
    val questionEn: String,
    val sentenceKo: String,
    val choices: List<AdminQuizDraftChoiceResponse>,
    val answerExplanationEn: String,
) {
    companion object {
        fun from(draft: AdminQuizDraft) =
            AdminQuizDraftResponse(
                id = draft.id.toString(),
                tag = draft.content.tag.databaseValue,
                difficulty = draft.content.difficulty.databaseValue,
                questionEn = draft.content.questionEn,
                sentenceKo = draft.content.sentenceKo,
                choices =
                    draft.content.choices
                        .sortedBy(QuizChoiceContent::sortOrder)
                        .map(AdminQuizDraftChoiceResponse::from),
                answerExplanationEn = draft.content.answerExplanationEn,
            )
    }
}

data class AdminQuizDraftChoiceResponse(
    val text: String,
    val isCorrect: Boolean,
) {
    companion object {
        fun from(choice: QuizChoiceContent) =
            AdminQuizDraftChoiceResponse(
                text = choice.text,
                isCorrect = choice.correct,
            )
    }
}

data class AdminQuizUpdateResponse(
    val quiz: AdminQuizStatusResponse,
)

data class AdminQuizStatusResponse(
    val id: String,
    val status: String,
) {
    companion object {
        fun from(result: QuizCommandResult.Success) =
            AdminQuizStatusResponse(
                id = result.quizId.toString(),
                status = result.status.databaseValue,
            )
    }
}

data class AdminQuizDeleteResponse(
    val deletedQuizId: String,
)
