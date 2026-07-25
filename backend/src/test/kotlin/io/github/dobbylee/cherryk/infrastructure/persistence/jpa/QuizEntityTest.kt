package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class QuizEntityTest {
    @Test
    fun `choice collection rejects duplicate order and multiple correct answers`() {
        val quiz = createQuiz()
        quiz.addChoice("은", false, 0)
        quiz.addChoice("을", true, 1)

        assertFailsWith<IllegalArgumentException> {
            quiz.addChoice("를", false, 1)
        }
        assertFailsWith<IllegalArgumentException> {
            quiz.addChoice("이", true, 2)
        }
    }

    @Test
    fun `choice collection rejects more than four choices`() {
        val quiz = createQuiz()
        quiz.addChoice("1", false, 0)
        quiz.addChoice("2", true, 1)
        quiz.addChoice("3", false, 2)
        quiz.addChoice("4", false, 3)

        assertFailsWith<IllegalArgumentException> {
            quiz.addChoice("5", false, 4)
        }
    }

    @Test
    fun `draft content requires four ordered choices and one answer`() {
        assertFailsWith<IllegalArgumentException> {
            content().copy(choices = content().choices.take(3))
        }
        assertFailsWith<IllegalArgumentException> {
            content().copy(
                choices = content().choices.map { choice -> choice.copy(correct = false) },
            )
        }
        assertFailsWith<IllegalArgumentException> {
            content().copy(
                choices =
                    content().choices.mapIndexed { index, choice ->
                        choice.copy(sortOrder = if (index == 3) 2 else index)
                    },
            )
        }
    }

    @Test
    fun `approved quiz content is immutable`() {
        val now = Instant.parse("2026-07-25T04:00:00Z")
        val quiz = QuizEntity.createDraft(content(), now = now)
        quiz.approve(now)
        val childChoice =
            QuizChoiceEntity(
                quiz = quiz,
                text = "을",
                correct = true,
                sortOrder = 1,
            )

        assertFailsWith<IllegalArgumentException> {
            quiz.editDraft(
                content = content().copy(sentenceKo = "수정할 수 없는 문장"),
                now = now.plusSeconds(1),
            )
        }
        assertFailsWith<IllegalArgumentException> {
            childChoice.updateDraftChoice(text = "를", correct = true)
        }
        assertEquals(QuizStatus.APPROVED, quiz.status)
        assertEquals("저는 물( ) 마셔요.", quiz.sentenceKo)
    }

    private fun createQuiz() =
        QuizEntity(
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            contentFingerprint = UUID.randomUUID().toString(),
            status = QuizStatus.DRAFT,
            questionEn = "Choose.",
            sentenceKo = "저는 물( ) 마셔요.",
            answerExplanationEn = "Use 을.",
        )

    private fun content() =
        QuizContent(
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            questionEn = "Choose.",
            sentenceKo = "저는 물( ) 마셔요.",
            choices =
                listOf(
                    QuizChoiceContent("은", false, 0),
                    QuizChoiceContent("을", true, 1),
                    QuizChoiceContent("에", false, 2),
                    QuizChoiceContent("이", false, 3),
                ),
            answerExplanationEn = "Use 을.",
        )
}
