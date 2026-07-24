package io.github.dobbylee.cherryk.domain.quiz

import java.nio.charset.StandardCharsets
import java.security.MessageDigest

data class QuizFingerprintChoice(
    val text: String,
    val isCorrect: Boolean,
)

data class QuizFingerprintInput(
    val tag: String,
    val difficulty: String,
    val sentenceKo: String,
    val choices: List<QuizFingerprintChoice>,
)

object QuizContentFingerprint {
    private const val FIELD_SEPARATOR = "\u001f"
    private const val CHOICE_SEPARATOR = "\u001d"
    private val innerWhitespace = Regex("[\\t\\n\\u000c\\r ]+")

    fun create(input: QuizFingerprintInput): String {
        val normalizedChoices =
            input.choices
                .map { choice ->
                    "${normalize(choice.text)}$CHOICE_SEPARATOR${if (choice.isCorrect) "1" else "0"}"
                }
                .sorted()
        val content =
            listOf(
                input.tag,
                input.difficulty,
                normalize(input.sentenceKo),
                *normalizedChoices.toTypedArray(),
            ).joinToString(FIELD_SEPARATOR)

        return MessageDigest
            .getInstance("SHA-256")
            .digest(content.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { byte -> "%02x".format(byte.toInt() and 0xff) }
    }

    private fun normalize(value: String): String = value.trim().replace(innerWhitespace, " ")
}
