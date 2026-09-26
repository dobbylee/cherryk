package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.quiz.learningTarget
import io.github.dobbylee.cherryk.domain.quiz.normalizeLearningTarget

internal class QuizDraftCandidateBatch {
    private val accepted = mutableListOf<QuizContent>()
    private val fingerprints = mutableSetOf<String>()
    private val learningTargets = mutableSetOf<String>()
    private val honorificAnswers = mutableSetOf<String>()
    private val exclusions = linkedSetOf<String>()

    val contents: List<QuizContent>
        get() = accepted.toList()

    val retryExclusions: List<String>
        get() = exclusions.toList()

    fun addNovel(contents: List<QuizContent>) {
        contents.forEach { content ->
            val fingerprint = content.fingerprint()
            val learningTarget = learningTargetIdentity(content)
            val honorificAnswer = content.honorificAnswerIdentity()
            if (
                fingerprint !in fingerprints &&
                learningTarget !in learningTargets &&
                (honorificAnswer == null || honorificAnswer !in honorificAnswers)
            ) {
                fingerprints += fingerprint
                learningTargets += learningTarget
                honorificAnswer?.let(honorificAnswers::add)
                accepted += content
            }
        }
    }

    fun excludeGenerated(contents: List<QuizContent>) {
        contents.forEach { content ->
            exclusions +=
                content
                    .learningTarget()
                    .promptLabel
                    .trim()
                    .take(MAX_RETRY_EXCLUSION_LENGTH)
        }
        while (exclusions.size > MAX_RETRY_EXCLUSIONS) {
            exclusions.remove(exclusions.first())
        }
    }
}

private const val MAX_RETRY_EXCLUSIONS = 40
private const val MAX_RETRY_EXCLUSION_LENGTH = 200

private fun learningTargetIdentity(content: QuizContent): String =
    listOf(
        content.quizType.databaseValue,
        content.tag.databaseValue,
        content.learningTarget().digest,
    ).joinToString("\u001f")

private fun QuizContent.honorificAnswerIdentity(): String? =
    if (quizType == QuizType.GRAMMAR && tag == GrammarTag.HONORIFIC) {
        normalizeLearningTarget(choices.single(QuizChoiceContent::correct).text)
    } else {
        null
    }
