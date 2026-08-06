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
    val sentenceKo: String?,
    val choices: List<QuizChoiceContent>,
    val answerExplanationEn: String,
    val quizType: QuizType = QuizType.GRAMMAR,
) {
    init {
        require(questionEn.isNotBlank()) { "Quiz question must not be blank." }
        require(quizType != QuizType.GRAMMAR || !sentenceKo.isNullOrBlank()) {
            "Grammar quiz sentence must not be blank."
        }
        require(answerExplanationEn.isNotBlank()) { "Quiz explanation must not be blank." }
        require(choices.size == 4) { "Quiz must contain exactly four choices." }
        require(choices.count(QuizChoiceContent::correct) == 1) {
            "Quiz must contain exactly one correct choice."
        }
        require(choices.map(QuizChoiceContent::sortOrder).toSet() == (0..3).toSet()) {
            "Quiz choice sortOrder values must be exactly zero through three."
        }
        require(quizType != QuizType.VOCABULARY || tag == GrammarTag.WORD_CHOICE) {
            "Vocabulary quizzes must use the word_choice tag."
        }
        if (quizType == QuizType.VOCABULARY) {
            require(isEnglishVocabularyDefinition(questionEn)) {
                "Vocabulary definitions must be written in English without revealing Korean text."
            }
            require(sentenceKo == null) {
                "Vocabulary quizzes must not include a Korean sentence."
            }
            require(choices.all { isKoreanVocabularyChoice(it.text) }) {
                "Vocabulary quiz choices must be Korean words."
            }
        }
    }

    fun fingerprint(): String =
        QuizContentFingerprint.create(
            QuizFingerprintInput(
                tag =
                    if (quizType == QuizType.VOCABULARY) {
                        "${quizType.databaseValue}:${tag.databaseValue}"
                    } else {
                        tag.databaseValue
                    },
                difficulty = difficulty.databaseValue,
                sentenceKo =
                    if (quizType == QuizType.VOCABULARY) {
                        questionEn
                    } else {
                        requireNotNull(sentenceKo)
                    },
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

fun isEnglishVocabularyDefinition(value: String): Boolean =
    value.any { it in 'A'..'Z' || it in 'a'..'z' } && value.none(::isHangulCharacter)

fun isKoreanVocabularyChoice(value: String): Boolean =
    value.any(::isHangulCharacter) && value.none { it in 'A'..'Z' || it in 'a'..'z' }

private fun isHangulCharacter(character: Char): Boolean =
    character in '\u1100'..'\u11ff' ||
        character in '\u3130'..'\u318f' ||
        character in '\uac00'..'\ud7af'
