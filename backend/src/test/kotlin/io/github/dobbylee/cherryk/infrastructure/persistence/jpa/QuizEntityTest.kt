package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import java.util.UUID
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
}
