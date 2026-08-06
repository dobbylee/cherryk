package io.github.dobbylee.cherryk.domain.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals

class QuizContentTest {
    @Test
    fun `accepts an English vocabulary definition with four Korean choices`() {
        val content = vocabularyContent()

        assertEquals(QuizType.VOCABULARY, content.quizType)
        assertEquals("도서관", content.choices.single(QuizChoiceContent::correct).text)
    }

    @Test
    fun `rejects vocabulary content that leaks Korean or includes an English choice`() {
        assertFailsWith<IllegalArgumentException> {
            vocabularyContent(questionEn = "도서관 means library.")
        }
        assertFailsWith<IllegalArgumentException> {
            vocabularyContent(
                choices = vocabularyChoices().map { choice ->
                    if (choice.correct) choice.copy(text = "library") else choice
                },
            )
        }
    }

    @Test
    fun `requires vocabulary quizzes to keep their type tag and omit a Korean sentence`() {
        assertFailsWith<IllegalArgumentException> {
            vocabularyContent(tag = GrammarTag.PARTICLE_OBJECT)
        }
        assertFailsWith<IllegalArgumentException> {
            vocabularyContent(sentenceKo = "설명에 맞는 단어를 고르세요.")
        }
    }

    @Test
    fun `vocabulary fingerprints include the English definition`() {
        val library = vocabularyContent()
        val bookstore = vocabularyContent(questionEn = "A place where people can buy books.")

        assertNotEquals(library.fingerprint(), bookstore.fingerprint())
        assertEquals(
            library.fingerprint(),
            vocabularyContent(
                questionEn = "  A place where people can  borrow books.  ",
            ).fingerprint(),
        )
    }

    @Test
    fun `grammar fingerprints remain backward compatible`() {
        val grammar =
            QuizContent(
                tag = GrammarTag.PARTICLE_OBJECT,
                difficulty = UserLevel.BEGINNER,
                questionEn = "Choose the correct particle.",
                sentenceKo = "저는 사과( ) 먹어요.",
                choices =
                    listOf(
                        QuizChoiceContent("은", false, 0),
                        QuizChoiceContent("를", true, 1),
                        QuizChoiceContent("에", false, 2),
                        QuizChoiceContent("이", false, 3),
                    ),
                answerExplanationEn = "Use 를.",
            )

        assertEquals(
            "882b70fac68cb46c00e6110918e6e98ca23ed28a57c55aa0d0420fd540800872",
            grammar.fingerprint(),
        )
    }

    private fun vocabularyContent(
        tag: GrammarTag = GrammarTag.WORD_CHOICE,
        questionEn: String = "A place where people can borrow books.",
        sentenceKo: String? = null,
        choices: List<QuizChoiceContent> = vocabularyChoices(),
    ) = QuizContent(
        tag = tag,
        difficulty = UserLevel.BEGINNER,
        questionEn = questionEn,
        sentenceKo = sentenceKo,
        choices = choices,
        answerExplanationEn = "도서관 means library.",
        quizType = QuizType.VOCABULARY,
    )

    private fun vocabularyChoices() =
        listOf(
            QuizChoiceContent("도서관", correct = true, sortOrder = 0),
            QuizChoiceContent("병원", correct = false, sortOrder = 1),
            QuizChoiceContent("학교", correct = false, sortOrder = 2),
            QuizChoiceContent("시장", correct = false, sortOrder = 3),
        )
}
