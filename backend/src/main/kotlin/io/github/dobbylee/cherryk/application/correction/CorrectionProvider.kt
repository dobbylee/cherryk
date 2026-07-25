package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel

data class CorrectionProviderInput(
    val text: String,
    val level: UserLevel,
)

data class CorrectionMistake(
    val tag: GrammarTag,
    val originalPart: String,
    val correctedPart: String,
    val explanationEn: String,
    val severity: MistakeSeverity,
)

data class CorrectionResult(
    val correctedText: String,
    val explanationEn: String,
    val mistakes: List<CorrectionMistake>,
)

fun interface CorrectionProvider {
    fun correct(input: CorrectionProviderInput): CorrectionResult
}

class CorrectionProviderException(
    val code: String,
    message: String,
    internal val retryable: Boolean = false,
) : RuntimeException(message)
