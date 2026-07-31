package io.github.dobbylee.cherryk.application.correction

import org.springframework.stereotype.Component

@Component
class CorrectionOutputGuard {
    fun guard(
        originalText: String,
        output: CorrectionResult,
    ): CorrectionResult {
        if (output.correctedText.isBlank() || output.explanationEn.isBlank()) {
            throw CorrectionOutputException()
        }

        if (originalText.normalizeWhitespace() == output.correctedText.normalizeWhitespace()) {
            return CorrectionResult(
                correctedText = originalText,
                explanationEn = "No corrections were needed.",
                mistakes = emptyList(),
            )
        }

        if (originalText.containsHangul() && !output.correctedText.isAcceptablyKoreanComparedWith(originalText)) {
            throw CorrectionOutputException()
        }

        return output.copy(
            mistakes =
                output.mistakes.filter { mistake ->
                    val describesChange = mistake.originalPart != mistake.correctedPart
                    val hasExplanation = mistake.explanationEn.isNotBlank()
                    val matchesOriginal =
                        mistake.originalPart.isEmpty() ||
                            originalText.contains(mistake.originalPart)
                    val matchesCorrection =
                        mistake.correctedPart.isEmpty() ||
                            output.correctedText.contains(mistake.correctedPart)

                    describesChange && hasExplanation && matchesOriginal && matchesCorrection
                },
        )
    }
}

class CorrectionOutputException :
    RuntimeException("AI correction output is invalid.") {
    val code = "invalid_ai_output"
}

private fun String.normalizeWhitespace(): String = trim().replace(Regex("\\s+"), " ")

private fun String.containsHangul(): Boolean = any(Char::isHangul)

private fun String.isAcceptablyKoreanComparedWith(originalText: String): Boolean {
    val outputStats = languageStats()
    if (outputStats.hangulCount == 0) {
        return false
    }

    val originalLatinWords =
        originalText
            .languageStats()
            .latinWords
            .mapTo(mutableSetOf(), String::lowercase)
    if (outputStats.latinWords.any { it.lowercase() !in originalLatinWords }) {
        return false
    }

    if (outputStats.hangulRuns >= outputStats.latinRuns) {
        return true
    }

    val originalStats = originalText.languageStats()
    if (originalStats.latinRuns == 0) {
        return false
    }

    return outputStats.hangulCount.toDouble() / outputStats.latinRuns >=
        originalStats.hangulCount.toDouble() / originalStats.latinRuns
}

private fun String.languageStats(): LanguageStats {
    val latinWords = LATIN_WORD.findAll(this).map(MatchResult::value).toList()
    return LanguageStats(
        hangulCount = count(Char::isHangul),
        hangulRuns = HANGUL_RUN.findAll(this).count(),
        latinRuns = latinWords.size,
        latinWords = latinWords,
    )
}

private fun Char.isHangul(): Boolean =
    this in '\u3131'..'\u318E' || this in '\uAC00'..'\uD7A3'

private data class LanguageStats(
    val hangulCount: Int,
    val hangulRuns: Int,
    val latinRuns: Int,
    val latinWords: List<String>,
)

private val LATIN_WORD = Regex("[A-Za-z]+")
private val HANGUL_RUN = Regex("[\\u3131-\\u318E\\uAC00-\\uD7A3]+")
