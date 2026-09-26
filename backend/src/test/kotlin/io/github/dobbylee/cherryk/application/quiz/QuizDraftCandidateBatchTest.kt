package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class QuizDraftCandidateBatchTest {
    @Test
    fun `keeps one candidate for the same content and learning target`() {
        val batch = QuizDraftCandidateBatch()
        val original = content("저는 사과( ) 먹어요.")
        val sameFingerprint = original.copy(answerExplanationEn = "A different explanation.")
        val sameTarget =
            original.copy(
                choices =
                    listOf(
                        QuizChoiceContent("가", false, 0),
                        QuizChoiceContent("를", true, 1),
                        QuizChoiceContent("은", false, 2),
                        QuizChoiceContent("이", false, 3),
                    ),
            )

        batch.addNovel(listOf(original, sameFingerprint, sameTarget))

        assertEquals(listOf(original), batch.contents)
    }

    @Test
    fun `honorific answers are distinct across different sentences`() {
        val batch = QuizDraftCandidateBatch()
        val first = content("할머니께서 물을 ( ).", GrammarTag.HONORIFIC)
        val second = content("선생님께서 식사를 ( ).", GrammarTag.HONORIFIC)

        batch.addNovel(listOf(first, second))

        assertEquals(listOf(first), batch.contents)
    }

    @Test
    fun `retry exclusions stay bounded and include rejected generated targets`() {
        val batch = QuizDraftCandidateBatch()
        val generated = (1..41).map { index -> content("$index-${"가".repeat(240)}") }

        batch.addNovel(generated.take(1))
        batch.excludeGenerated(generated)

        assertEquals(1, batch.contents.size)
        assertEquals(40, batch.retryExclusions.size)
        assertTrue(batch.retryExclusions.all { it.length <= 200 })
        assertFalse(batch.retryExclusions.any { it.startsWith("1-") })
        assertTrue(batch.retryExclusions.last().startsWith("41-"))
    }

    private fun content(
        sentence: String,
        tag: GrammarTag = GrammarTag.PARTICLE_OBJECT,
    ) = QuizContent(
        tag = tag,
        difficulty = UserLevel.BEGINNER,
        questionEn = "Choose the correct answer.",
        sentenceKo = sentence,
        choices =
            listOf(
                QuizChoiceContent("은", false, 0),
                QuizChoiceContent(if (tag == GrammarTag.HONORIFIC) "드세요" else "를", true, 1),
                QuizChoiceContent("에", false, 2),
                QuizChoiceContent("이", false, 3),
            ),
        answerExplanationEn = "Use the correct answer.",
    )
}
