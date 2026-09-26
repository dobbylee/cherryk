package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class QuizDraftOutputGuardTest {
    private val guard = QuizDraftOutputGuard()

    @Test
    fun `rejects an incorrect batch shape before any draft is stored`() {
        val input = input()
        val content = grammarContent()

        listOf(
            emptyList(),
            listOf(content, content),
            listOf(content.copy(tag = GrammarTag.HONORIFIC)),
            listOf(content.copy(difficulty = UserLevel.INTERMEDIATE)),
        ).forEach { contents ->
            val failure = assertFailsWith<AdminQuizApplicationException> { guard.validate(contents, input) }
            assertEquals("invalid_ai_output", failure.code)
        }
    }

    @Test
    fun `requires a vocabulary answer to match the claimed target`() {
        val content =
            QuizContent(
                quizType = QuizType.VOCABULARY,
                tag = GrammarTag.WORD_CHOICE,
                difficulty = UserLevel.BEGINNER,
                questionEn = "A place to borrow books.",
                sentenceKo = null,
                choices =
                    listOf(
                        QuizChoiceContent("도서관", true, 0),
                        QuizChoiceContent("학교", false, 1),
                        QuizChoiceContent("병원", false, 2),
                        QuizChoiceContent("시장", false, 3),
                    ),
                answerExplanationEn = "Library means 도서관.",
            )
        val input =
            input().copy(
                quizType = QuizType.VOCABULARY,
                tag = GrammarTag.WORD_CHOICE,
                vocabularyTargets = listOf("도서관"),
            )

        guard.validate(listOf(content), input)
        assertEquals(
            "invalid_ai_output",
            assertFailsWith<AdminQuizApplicationException> {
                guard.validate(listOf(content), input.copy(vocabularyTargets = listOf("학교")))
            }.code,
        )
    }

    @Test
    fun `spacing answer must only change whitespace and correct a wrong stem`() {
        val input = input().copy(tag = GrammarTag.SPACING)
        val content = grammarContent().copy(
            tag = GrammarTag.SPACING,
            sentenceKo = "저는학교에 가요.",
            choices =
                listOf(
                    QuizChoiceContent("저는학교에 가요.", false, 0),
                    QuizChoiceContent("저는 학교에가요.", false, 1),
                    QuizChoiceContent("저는 학교에 가요.", true, 2),
                    QuizChoiceContent("저 는학교에 가요.", false, 3),
                ),
        )

        guard.validate(listOf(content), input)
        listOf(
            content.copy(sentenceKo = "저는 학교에 가요."),
            content.copy(sentenceKo = "저는 학원에 가요."),
        ).forEach { invalid ->
            assertEquals(
                "invalid_ai_output",
                assertFailsWith<AdminQuizApplicationException> { guard.validate(listOf(invalid), input) }.code,
            )
        }
    }

    private fun input() =
        QuizDraftProviderInput(
            quizType = QuizType.GRAMMAR,
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            count = 1,
            instruction = null,
            vocabularyTargets = emptyList(),
            avoidLearningTargets = emptyList(),
        )

    private fun grammarContent() =
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
            answerExplanationEn = "Use 를 for the object.",
        )
}
