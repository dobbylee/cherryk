package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.quiz.MAX_VOCABULARY_TARGET_LENGTH
import io.github.dobbylee.cherryk.domain.quiz.isKoreanVocabularyChoice
import io.github.dobbylee.cherryk.domain.quiz.normalizeLearningTarget
import io.github.dobbylee.cherryk.domain.user.UserLevel

data class QuizDraftProviderInput(
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val count: Int,
    val instruction: String? = null,
    val quizType: QuizType = QuizType.GRAMMAR,
    val vocabularyTargets: List<String> = emptyList(),
    val avoidLearningTargets: List<String> = emptyList(),
) {
    init {
        require(quizType != QuizType.VOCABULARY || tag == GrammarTag.WORD_CHOICE) {
            "Vocabulary quiz drafts must use the word_choice tag."
        }
        require(count in 1..20) { "Quiz draft count must be between 1 and 20." }
        require(instruction == null || instruction.length <= 1000) {
            "Quiz draft instruction must not exceed 1000 characters."
        }
        require(
            quizType != QuizType.VOCABULARY ||
                vocabularyTargets.size == count,
        ) {
            "Vocabulary quiz drafts must provide one target word per question."
        }
        require(quizType != QuizType.GRAMMAR || vocabularyTargets.isEmpty()) {
            "Grammar quiz drafts must not provide vocabulary targets."
        }
        require(vocabularyTargets.all(::isKoreanVocabularyChoice)) {
            "Vocabulary target words must be Korean words."
        }
        require(vocabularyTargets.all { it.length <= MAX_VOCABULARY_TARGET_LENGTH }) {
            "Vocabulary target words must not exceed $MAX_VOCABULARY_TARGET_LENGTH characters."
        }
        require(
            vocabularyTargets
                .map(::normalizeLearningTarget)
                .distinct()
                .size == vocabularyTargets.size,
        ) {
            "Vocabulary target words must be unique."
        }
        require(avoidLearningTargets.size <= 40) {
            "Quiz draft exclusions must contain at most 40 learning targets."
        }
        require(avoidLearningTargets.all { it.isNotBlank() && it.length <= 200 }) {
            "Quiz draft exclusions must be nonblank and at most 200 characters each."
        }
    }
}

fun interface QuizDraftProvider {
    fun generate(input: QuizDraftProviderInput): List<QuizContent>
}

class QuizDraftProviderException(
    val code: String,
    message: String,
    internal val retryable: Boolean = false,
) : RuntimeException(message)
