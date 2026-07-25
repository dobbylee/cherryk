package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class CorrectionOutputGuardTest {
    private val guard = CorrectionOutputGuard()

    @Test
    fun `preserves the original when only whitespace or line breaks changed`() {
        val result =
            guard.guard(
                originalText = "저는 학교에\n가요.",
                output =
                    CorrectionResult(
                        correctedText = "  저는   학교에 가요. ",
                        explanationEn = "The line break changed.",
                        mistakes =
                            listOf(
                                mistake(
                                    originalPart = "학교에\n가요",
                                    correctedPart = "학교에 가요",
                                ),
                            ),
                    ),
            )

        assertEquals("저는 학교에\n가요.", result.correctedText)
        assertEquals("No corrections were needed.", result.explanationEn)
        assertEquals(emptyList(), result.mistakes)
    }

    @Test
    fun `rejects an English translation of Korean input`() {
        val exception =
            assertFailsWith<CorrectionOutputException> {
                guard.guard(
                    originalText = "저는 학교에 가요.",
                    output =
                        CorrectionResult(
                            correctedText = "I go to school.",
                            explanationEn = "Translated instead of corrected.",
                            mistakes = emptyList(),
                        ),
                )
            }

        assertEquals("invalid_ai_output", exception.code)
        assertEquals("AI correction output is invalid.", exception.message)
    }

    @Test
    fun `allows existing Latin words but rejects newly introduced English`() {
        val allowed =
            guard.guard(
                originalText = "오늘 OpenAI를 써요.",
                output =
                    CorrectionResult(
                        correctedText = "오늘 OpenAI를 사용해요.",
                        explanationEn = "A more natural verb.",
                        mistakes = listOf(mistake("써요", "사용해요")),
                    ),
            )

        assertEquals("오늘 OpenAI를 사용해요.", allowed.correctedText)

        assertFailsWith<CorrectionOutputException> {
            guard.guard(
                originalText = "오늘 인공지능을 써요.",
                output =
                    CorrectionResult(
                        correctedText = "오늘 AI를 사용해요.",
                        explanationEn = "Introduced an English abbreviation.",
                        mistakes = emptyList(),
                    ),
            )
        }
    }

    @Test
    fun `keeps only mistakes that describe real matching changes`() {
        val valid = mistake(originalPart = "학교를", correctedPart = "학교에")
        val insertion = mistake(originalPart = "", correctedPart = "잘 ")
        val result =
            guard.guard(
                originalText = "저는 학교를 가요.",
                output =
                    CorrectionResult(
                        correctedText = "저는 학교에 잘 가요.",
                        explanationEn = "Use the destination particle.",
                        mistakes =
                            listOf(
                                valid,
                                insertion,
                                mistake("학교를", "학교를"),
                                mistake("없는 말", "학교에"),
                                mistake("학교를", "없는 말"),
                            ),
                    ),
            )

        assertEquals(listOf(valid, insertion), result.mistakes)
    }

    private fun mistake(
        originalPart: String,
        correctedPart: String,
    ) = CorrectionMistake(
        tag = GrammarTag.PARTICLE_LOCATION,
        originalPart = originalPart,
        correctedPart = correctedPart,
        explanationEn = "Use the destination particle.",
        severity = MistakeSeverity.MINOR,
    )
}
