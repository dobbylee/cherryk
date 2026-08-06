package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.AdminQuizDraftRequest
import io.github.dobbylee.cherryk.application.quiz.AdminQuizUpdate
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import tools.jackson.databind.JsonNode

data class AdminQuizDraftCreateRequest(
    val quizType: QuizType,
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val count: Int,
    val instruction: String?,
) {
    fun toApplicationRequest() =
        AdminQuizDraftRequest(
            quizType = quizType,
            tag = tag,
            difficulty = difficulty,
            count = count,
            instruction = instruction,
        )

    companion object {
        fun fromJson(payload: JsonNode): AdminQuizDraftCreateRequest? {
            if (!payload.isObject) {
                return null
            }
            val quizType =
                if (payload.has("quizType")) {
                    payload.textValue("quizType")?.let(QuizType::fromDatabaseOrNull) ?: return null
                } else {
                    QuizType.GRAMMAR
                }
            val tag =
                payload.textValue("tag")
                    ?.let(GrammarTag::fromDatabaseOrNull)
                    ?: return null
            if (quizType == QuizType.VOCABULARY && tag != GrammarTag.WORD_CHOICE) {
                return null
            }
            val difficultyValue = payload.textValue("difficulty") ?: return null
            val difficulty =
                UserLevel.entries.firstOrNull { it.databaseValue == difficultyValue }
                    ?: return null
            val count = payload.get("count")?.exactInt()?.takeIf { it in 1..20 } ?: return null
            val instruction =
                if (payload.has("instruction")) {
                    payload
                        .textValue("instruction")
                        ?.trim()
                        ?.takeIf { it.length <= MAX_QUIZ_INSTRUCTION_LENGTH }
                        ?: return null
                } else {
                    null
                }
            return AdminQuizDraftCreateRequest(quizType, tag, difficulty, count, instruction)
        }
    }
}

data class AdminQuizUpdateRequest(
    val tag: GrammarTag?,
    val difficulty: UserLevel?,
    val questionEn: String?,
    val sentenceKo: String?,
    val choices: List<AdminQuizChoiceUpdate>?,
    val answerExplanationEn: String?,
    val status: QuizStatus?,
) {
    fun toApplicationUpdate() =
        AdminQuizUpdate(
            tag = tag,
            difficulty = difficulty,
            questionEn = questionEn,
            sentenceKo = sentenceKo,
            choices = choices?.map(AdminQuizChoiceUpdate::toContent),
            answerExplanationEn = answerExplanationEn,
            status = status,
        )

    companion object {
        fun fromJson(payload: JsonNode): AdminQuizUpdateRequest? {
            if (!payload.isObject || UPDATE_FIELDS.none(payload::has)) {
                return null
            }
            val tag =
                payload.optionalText("tag")
                    ?.let(GrammarTag::fromDatabaseOrNull)
                    ?: if (payload.has("tag")) return null else null
            val difficulty =
                payload.optionalText("difficulty")?.let { value ->
                    UserLevel.entries.firstOrNull { it.databaseValue == value }
                } ?: if (payload.has("difficulty")) return null else null
            val questionEn = payload.optionalNonBlankText("questionEn") ?: if (payload.has("questionEn")) return null else null
            val sentenceKo = payload.optionalNonBlankText("sentenceKo") ?: if (payload.has("sentenceKo")) return null else null
            val answerExplanationEn =
                payload.optionalNonBlankText("answerExplanationEn")
                    ?: if (payload.has("answerExplanationEn")) return null else null
            val choices =
                if (payload.has("choices")) {
                    AdminQuizChoiceUpdate.fromJson(payload.get("choices")) ?: return null
                } else {
                    null
                }
            val status =
                payload.optionalText("status")?.let { value ->
                    ADMIN_UPDATE_STATUSES.firstOrNull { it.databaseValue == value }
                } ?: if (payload.has("status")) return null else null

            return AdminQuizUpdateRequest(
                tag = tag,
                difficulty = difficulty,
                questionEn = questionEn,
                sentenceKo = sentenceKo,
                choices = choices,
                answerExplanationEn = answerExplanationEn,
                status = status,
            )
        }
    }
}

data class AdminQuizChoiceUpdate(
    val text: String,
    val correct: Boolean,
    val sortOrder: Int,
) {
    fun toContent() = QuizChoiceContent(text, correct, sortOrder)

    companion object {
        fun fromJson(payload: JsonNode?): List<AdminQuizChoiceUpdate>? {
            if (payload == null || !payload.isArray || payload.size() != 4) {
                return null
            }
            val choices = mutableListOf<AdminQuizChoiceUpdate>()
            for (choice in payload) {
                if (!choice.isObject) {
                    return null
                }
                if (
                    choice.size() != ADMIN_CHOICE_UPDATE_FIELDS.size ||
                    ADMIN_CHOICE_UPDATE_FIELDS.any { !choice.has(it) }
                ) {
                    return null
                }
                val text =
                    choice.textValue("text")?.trim()?.takeIf(String::isNotEmpty)
                        ?: return null
                val correct =
                    choice.get("isCorrect")?.takeIf(JsonNode::isBoolean)?.booleanValue()
                        ?: return null
                val sortOrder = choice.get("sortOrder")?.exactInt() ?: return null
                choices +=
                    AdminQuizChoiceUpdate(
                        text = text,
                        correct = correct,
                        sortOrder = sortOrder,
                    )
            }
            if (choices.count(AdminQuizChoiceUpdate::correct) != 1) {
                return null
            }
            if (choices.map(AdminQuizChoiceUpdate::sortOrder).toSet() != (0..3).toSet()) {
                return null
            }
            return choices
        }
    }
}

private fun JsonNode.textValue(fieldName: String): String? =
    get(fieldName)?.takeIf(JsonNode::isString)?.stringValue()

private fun JsonNode.optionalText(fieldName: String): String? = textValue(fieldName)

private fun JsonNode.optionalNonBlankText(fieldName: String): String? =
    textValue(fieldName)?.trim()?.takeIf(String::isNotEmpty)

private fun JsonNode.exactInt(): Int? {
    if (!isNumber) {
        return null
    }
    val value = doubleValue()
    return value
        .takeIf { it.isFinite() && it % 1.0 == 0.0 && it >= Int.MIN_VALUE && it <= Int.MAX_VALUE }
        ?.toInt()
}

private const val MAX_QUIZ_INSTRUCTION_LENGTH = 1000
private val UPDATE_FIELDS =
    setOf(
        "tag",
        "difficulty",
        "questionEn",
        "sentenceKo",
        "choices",
        "answerExplanationEn",
        "status",
    )
private val ADMIN_CHOICE_UPDATE_FIELDS = setOf("text", "isCorrect", "sortOrder")
private val ADMIN_UPDATE_STATUSES = setOf(QuizStatus.DRAFT, QuizStatus.APPROVED)
