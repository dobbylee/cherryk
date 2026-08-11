package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.AdminQuizDraft
import io.github.dobbylee.cherryk.application.quiz.AdminQuizTagCount
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent

data class AdminQuizDraftGenerationResponse(
    val drafts: List<AdminQuizDraftResponse>,
)

data class AdminQuizTagCountsResponse(
    val tagCounts: List<AdminQuizTagCountResponse>,
)

data class AdminQuizTagCountResponse(
    val tag: String,
    val totalCount: Long,
    val approvedCount: Long,
    val draftCount: Long,
) {
    companion object {
        fun from(count: AdminQuizTagCount) =
            AdminQuizTagCountResponse(
                tag = count.tag.databaseValue,
                totalCount = count.totalCount,
                approvedCount = count.approvedCount,
                draftCount = count.draftCount,
            )
    }
}

data class AdminQuizDraftResponse(
    val id: String,
    val quizType: String,
    val tag: String,
    val difficulty: String,
    val questionEn: String,
    val sentenceKo: String?,
    val choices: List<AdminQuizDraftChoiceResponse>,
    val answerExplanationEn: String,
) {
    companion object {
        fun from(draft: AdminQuizDraft) =
            AdminQuizDraftResponse(
                id = draft.id.toString(),
                quizType = draft.content.quizType.databaseValue,
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
