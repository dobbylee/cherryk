package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel

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

data class AdminQuizTagCount(
    val tag: GrammarTag,
    val draftCount: Long,
    val approvedCount: Long,
) {
    val totalCount: Long
        get() = draftCount + approvedCount
}

fun interface AdminQuizInventoryRepository {
    fun countActiveQuizzesByTag(): List<AdminQuizTagCount>
}

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
