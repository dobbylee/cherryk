package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderException
import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderInput
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.quiz.isEnglishVocabularyDefinition
import io.github.dobbylee.cherryk.domain.quiz.isKoreanVocabularyChoice
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue

internal class OpenAiQuizDraftResponseMapper(
    private val objectMapper: ObjectMapper,
    private val randomIndex: (Int) -> Int,
) {
    fun parseOutput(
        outputText: String,
        input: QuizDraftProviderInput,
    ): List<QuizContent> {
        val output =
            try {
                objectMapper.readValue<OpenAiQuizDraftOutput>(outputText)
            } catch (exception: RuntimeException) {
                throw QuizDraftProviderException(
                    code = "invalid_response",
                    message = "OpenAI quiz output was not valid JSON.",
                )
            }
        if (output.questions.size != input.count) {
            throw invalidQuizOutput()
        }

        return try {
            val contents =
                output.questions.map { question ->
                    val correctAnswer = normalizeText(question.correctAnswer)
                    val distractors = question.distractors.map(::normalizeText)
                    val normalizedAnswers = (listOf(correctAnswer) + distractors).map(::comparisonKey)
                    require(normalizedAnswers.none(String::isBlank))
                    require(normalizedAnswers.toSet().size == 4)
                    require(question.explanationEn.isNotBlank())

                    val questionEn =
                        when (input.quizType) {
                            QuizType.GRAMMAR -> questionInstruction(input.tag)
                            QuizType.VOCABULARY ->
                                normalizeVocabularyDefinition(requireNotNull(question.questionEn))
                        }
                    val sentenceKo =
                        when (input.quizType) {
                            QuizType.GRAMMAR ->
                                normalizeGrammarSentence(
                                    value = requireNotNull(question.sentenceKo),
                                    tag = input.tag,
                                )
                            QuizType.VOCABULARY -> {
                                require((listOf(correctAnswer) + distractors).all(::isKoreanVocabularyChoice))
                                null
                            }
                        }

                    QuizContent(
                        tag = input.tag,
                        difficulty = input.difficulty,
                        questionEn = questionEn,
                        sentenceKo = sentenceKo,
                        choices =
                            shuffledChoices(correctAnswer, distractors).mapIndexed { index, choice ->
                                QuizChoiceContent(
                                    text = choice.text,
                                    correct = choice.correct,
                                    sortOrder = index,
                                )
                            },
                        answerExplanationEn =
                            "Correct answer: $correctAnswer. ${question.explanationEn.trim()}",
                        quizType = input.quizType,
                    )
                }
            if (input.quizType == QuizType.VOCABULARY) {
                require(
                    contents.map { content ->
                        comparisonKey(content.choices.single(QuizChoiceContent::correct).text)
                    } == input.vocabularyTargets.map(::comparisonKey),
                )
            }
            contents
        } catch (exception: IllegalArgumentException) {
            throw invalidQuizOutput()
        }
    }

    private fun shuffledChoices(
        correctAnswer: String,
        distractors: List<String>,
    ): List<GeneratedChoice> {
        val choices =
            (listOf(GeneratedChoice(correctAnswer, true)) +
                distractors.map { distractor -> GeneratedChoice(distractor, false) })
                .toMutableList()
        for (index in choices.lastIndex downTo 1) {
            val swapIndex = randomIndex(index + 1)
            require(swapIndex in 0..index) { "Quiz random index was outside its bound." }
            val previous = choices[index]
            choices[index] = choices[swapIndex]
            choices[swapIndex] = previous
        }
        return choices
    }

    private fun invalidQuizOutput() =
        QuizDraftProviderException(
            code = "invalid_response",
            message = "OpenAI quiz output did not match the required content rules.",
        )
}

private data class GeneratedChoice(
    val text: String,
    val correct: Boolean,
)

private data class OpenAiQuizDraftOutput(
    val questions: List<OpenAiQuizDraftQuestion>,
)

private data class OpenAiQuizDraftQuestion(
    val questionEn: String? = null,
    val sentenceKo: String? = null,
    val correctAnswer: String,
    val distractors: List<String>,
    val explanationEn: String,
)

private fun normalizeText(value: String): String = value.trim().replace(INNER_WHITESPACE, " ")

private fun comparisonKey(value: String): String = normalizeText(value).lowercase()

private fun normalizeVocabularyDefinition(value: String): String {
    val definition = normalizeText(value)
    require(isEnglishVocabularyDefinition(definition)) {
        "Vocabulary definition must be written in English without revealing Korean text."
    }
    return definition
}

private fun normalizeGrammarSentence(
    value: String,
    tag: GrammarTag,
): String {
    val trimmed = value.trim()
    val withoutPrefix =
        if (tag == GrammarTag.UNNATURAL) {
            trimmed
        } else {
            val prefix = KOREAN_DIRECTIVE_PREFIX.find(trimmed)
            if (prefix != null && isInstructionForTag(prefix.value, tag)) {
                trimmed.removeRange(prefix.range).trimStart()
            } else {
                trimmed
            }
        }
    require(withoutPrefix.isNotBlank()) { "Quiz sentence must not be blank." }
    return withoutPrefix
}

private fun isInstructionForTag(
    prefix: String,
    tag: GrammarTag,
): Boolean {
    if (GENERIC_NEXT_CHOICE.containsMatchIn(prefix)) {
        return true
    }

    val instructionTerms =
        when (tag) {
            GrammarTag.PARTICLE_SUBJECT,
            GrammarTag.PARTICLE_TOPIC,
            GrammarTag.PARTICLE_OBJECT,
            GrammarTag.PARTICLE_LOCATION,
            -> listOf("조사")
            GrammarTag.VERB_CONJUGATION -> listOf("동사", "활용형", "변형")
            GrammarTag.HONORIFIC -> listOf("높임말", "존댓말", "경어")
            GrammarTag.SPACING -> listOf("띄어쓰기", "띄어 쓰기")
            GrammarTag.WORD_CHOICE -> listOf("단어", "표현", "어휘")
            GrammarTag.SENTENCE_ORDER -> listOf("단어", "문장", "순서", "어순")
            GrammarTag.MISSING_WORD -> listOf("빈칸", "단어", "누락")
            GrammarTag.UNNATURAL -> emptyList()
        }
    return instructionTerms.any { term -> containsBoundedKoreanTerm(prefix, term) }
}

private fun containsBoundedKoreanTerm(
    value: String,
    term: String,
): Boolean =
    Regex(
        """(?:^|\s)${Regex.escape(term)}(?:으로|에서|에게|부터|까지|을|를|이|가|은|는|의|로|에|와|과)?(?=\s|[,，:：.]|$)""",
    ).containsMatchIn(value)

private fun questionInstruction(tag: GrammarTag): String =
    when (tag) {
        GrammarTag.PARTICLE_SUBJECT,
        GrammarTag.PARTICLE_TOPIC,
        GrammarTag.PARTICLE_OBJECT,
        GrammarTag.PARTICLE_LOCATION,
        -> "Choose the correct particle."
        GrammarTag.VERB_CONJUGATION -> "Choose the correctly conjugated verb."
        GrammarTag.HONORIFIC -> "Choose the correct honorific form."
        GrammarTag.SPACING -> "Choose the correctly spaced sentence."
        GrammarTag.WORD_CHOICE -> "Choose the most natural word."
        GrammarTag.SENTENCE_ORDER -> "Choose the sentence with the correct word order."
        GrammarTag.MISSING_WORD -> "Choose the missing word."
        GrammarTag.UNNATURAL -> "Choose the most natural sentence."
    }

private val KOREAN_DIRECTIVE_PREFIX =
    Regex(
        """^다음[^:：.\r\n]*(?:세요|시오|십시오|하라)[^:：.\r\n]*(?:[:：]|\.\s+|\r?\n)\s*""",
    )

private val GENERIC_NEXT_CHOICE =
    Regex("""^다음\s+중(?:에서|에)?(?=\s|[,，:：.]|$)""")

private val INNER_WHITESPACE = Regex("[\\t\\n\\u000c\\r ]+")
