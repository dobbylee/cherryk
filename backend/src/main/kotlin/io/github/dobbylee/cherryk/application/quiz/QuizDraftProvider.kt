package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel

data class QuizDraftProviderInput(
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val count: Int,
    val instruction: String? = null,
    val quizType: QuizType = QuizType.GRAMMAR,
) {
    init {
        require(quizType != QuizType.VOCABULARY || tag == GrammarTag.WORD_CHOICE) {
            "Vocabulary quiz drafts must use the word_choice tag."
        }
        require(count in 1..20) { "Quiz draft count must be between 1 and 20." }
        require(instruction == null || instruction.length <= 1000) {
            "Quiz draft instruction must not exceed 1000 characters."
        }
    }
}

fun interface QuizDraftProvider {
    fun generate(input: QuizDraftProviderInput): List<QuizContent>
}

class QuizDraftProviderException(
    val code: String,
    message: String,
    internal val retryable: Boolean = false,
) : RuntimeException(message)
