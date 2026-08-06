package io.github.dobbylee.cherryk.domain.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.text.Normalizer

data class QuizLearningTarget(
    val key: String,
    val digest: String,
    val promptLabel: String,
)

fun QuizContent.learningTarget(): QuizLearningTarget {
    val correctAnswer = choices.single(QuizChoiceContent::correct).text
    val normalizedAnswer = normalizeLearningTarget(correctAnswer)
    val targetKey =
        when (quizType) {
            QuizType.VOCABULARY -> normalizedAnswer
            QuizType.GRAMMAR ->
                when (tag) {
                    GrammarTag.SENTENCE_ORDER,
                    GrammarTag.UNNATURAL,
                    -> normalizedAnswer
                    else ->
                        listOf(
                            normalizeLearningTarget(requireNotNull(sentenceKo)),
                            normalizedAnswer,
                        ).joinToString(LEARNING_TARGET_SEPARATOR)
                }
        }
    val promptLabel =
        when {
            quizType == QuizType.VOCABULARY -> correctAnswer
            tag == GrammarTag.SENTENCE_ORDER || tag == GrammarTag.UNNATURAL -> correctAnswer
            else -> "${requireNotNull(sentenceKo)} -> $correctAnswer"
        }

    return QuizLearningTarget(
        key = targetKey,
        digest = learningTargetDigest(targetKey),
        promptLabel = promptLabel,
    )
}

fun normalizeLearningTarget(value: String): String =
    Normalizer
        .normalize(value, Normalizer.Form.NFC)
        .trim()
        .replace(LEARNING_TARGET_WHITESPACE, " ")
        .lowercase()

fun learningTargetDigest(value: String): String =
    MessageDigest
        .getInstance("SHA-256")
        .digest(value.toByteArray(StandardCharsets.UTF_8))
        .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }

const val MAX_VOCABULARY_TARGET_LENGTH = 50

private const val LEARNING_TARGET_SEPARATOR = "\u001f"
private val LEARNING_TARGET_WHITESPACE = Regex("\\s+")
