package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.quiz.normalizeLearningTarget
import org.springframework.stereotype.Component

@Component
class QuizDraftOutputGuard {
    fun validate(
        contents: List<QuizContent>,
        input: QuizDraftProviderInput,
    ) {
        val hasExpectedShape =
            contents.size == input.count &&
                contents.all { content ->
                    content.quizType == input.quizType &&
                        content.tag == input.tag &&
                        content.difficulty == input.difficulty
                }
        val hasExpectedVocabularyTargets =
            input.quizType != QuizType.VOCABULARY ||
                contents.map { content ->
                    normalizeLearningTarget(
                        content.choices.single(QuizChoiceContent::correct).text,
                    )
                } == input.vocabularyTargets.map(::normalizeLearningTarget)
        val hasValidTagContent =
            input.quizType != QuizType.GRAMMAR ||
                input.tag != GrammarTag.SPACING ||
                contents.all(QuizContent::isValidSpacingExercise)
        if (!hasExpectedShape || !hasExpectedVocabularyTargets || !hasValidTagContent) {
            throw AdminQuizApplicationException(
                code = "invalid_ai_output",
                message = "AI quiz draft output is invalid.",
            )
        }
    }
}

private fun QuizContent.isValidSpacingExercise(): Boolean {
    val exercise = sentenceKo ?: return false
    val correctAnswer = choices.single(QuizChoiceContent::correct).text
    val exerciseText = exercise.withoutWhitespace()
    return exercise.trim() != correctAnswer.trim() &&
        exerciseText == correctAnswer.withoutWhitespace() &&
        choices.all { choice -> choice.text.withoutWhitespace() == exerciseText }
}

private fun String.withoutWhitespace(): String = filterNot(Char::isWhitespace)
