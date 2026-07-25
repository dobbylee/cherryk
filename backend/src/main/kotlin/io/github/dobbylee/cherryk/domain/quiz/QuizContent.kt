package io.github.dobbylee.cherryk.domain.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel

data class QuizChoiceContent(
    val text: String,
    val correct: Boolean,
    val sortOrder: Int,
) {
    init {
        require(text.isNotBlank()) { "Quiz choice text must not be blank." }
        require(sortOrder in 0..3) { "Quiz choice sortOrder must be between zero and three." }
    }
}

data class QuizContent(
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val questionEn: String,
    val sentenceKo: String,
    val choices: List<QuizChoiceContent>,
    val answerExplanationEn: String,
) {
    init {
        require(questionEn.isNotBlank()) { "Quiz question must not be blank." }
        require(sentenceKo.isNotBlank()) { "Quiz sentence must not be blank." }
        require(answerExplanationEn.isNotBlank()) { "Quiz explanation must not be blank." }
        require(choices.size == 4) { "Quiz must contain exactly four choices." }
        require(choices.count(QuizChoiceContent::correct) == 1) {
            "Quiz must contain exactly one correct choice."
        }
        require(choices.map(QuizChoiceContent::sortOrder).toSet() == (0..3).toSet()) {
            "Quiz choice sortOrder values must be exactly zero through three."
        }
    }

    fun fingerprint(): String =
        QuizContentFingerprint.create(
            QuizFingerprintInput(
                tag = tag.databaseValue,
                difficulty = difficulty.databaseValue,
                sentenceKo = sentenceKo,
                choices =
                    choices.map { choice ->
                        QuizFingerprintChoice(
                            text = choice.text,
                            isCorrect = choice.correct,
                        )
                    },
            ),
        )
}
