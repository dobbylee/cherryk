package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.AdminQuizApplicationException
import io.github.dobbylee.cherryk.application.quiz.AdminQuizApplicationService
import io.github.dobbylee.cherryk.application.quiz.AdminQuizDraft
import io.github.dobbylee.cherryk.application.quiz.AdminQuizDraftRequest
import io.github.dobbylee.cherryk.application.quiz.AdminQuizUpdate
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.JsonNode

@RestController
@RequestMapping("/api/v1/admin/quizzes")
class AdminQuizController(
    private val service: AdminQuizApplicationService,
) {
    @PostMapping(
        "/generate-drafts",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun generateDrafts(
        @RequestBody payload: JsonNode,
    ): AdminQuizDraftGenerationResponse {
        val request =
            AdminQuizDraftCreateRequest.fromJson(payload)
                ?: throw AdminQuizInvalidRequestException("Quiz draft request is invalid.")
        val drafts =
            try {
                service.generateDrafts(request.toApplicationRequest())
            } catch (exception: AdminQuizApplicationException) {
                throw exception
            } catch (exception: RuntimeException) {
                throw AdminQuizUnavailableException(
                    "Quiz draft generation is unavailable.",
                    exception,
                )
            }
        return AdminQuizDraftGenerationResponse(
            drafts = drafts.map(AdminQuizDraftResponse::from),
        )
    }

    @PatchMapping(
        "/{id}",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun updateDraft(
        @PathVariable id: String,
        @RequestBody payload: JsonNode,
    ): AdminQuizUpdateResponse {
        val quizId = id.toPositiveLongOrNull() ?: throw invalidQuizId()
        val request =
            AdminQuizUpdateRequest.fromJson(payload)
                ?: throw AdminQuizInvalidRequestException("Quiz update request is invalid.")
        val updated =
            try {
                service.updateDraft(quizId, request.toApplicationUpdate())
            } catch (exception: AdminQuizApplicationException) {
                throw exception
            } catch (exception: RuntimeException) {
                throw AdminQuizUnavailableException("Quiz update is unavailable.", exception)
            }
        return AdminQuizUpdateResponse(
            quiz = AdminQuizStatusResponse.from(updated),
        )
    }

    @DeleteMapping(
        "/{id}",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun rejectDraft(
        @PathVariable id: String,
    ): AdminQuizDeleteResponse {
        val quizId = id.toPositiveLongOrNull() ?: throw invalidQuizId()
        val deletedId =
            try {
                service.rejectDraft(quizId)
            } catch (exception: AdminQuizApplicationException) {
                throw exception
            } catch (exception: RuntimeException) {
                throw AdminQuizUnavailableException("Quiz deletion is unavailable.", exception)
            }
        return AdminQuizDeleteResponse(deletedQuizId = deletedId.toString())
    }

    private fun invalidQuizId() = AdminQuizInvalidRequestException("Quiz id is invalid.")
}

data class AdminQuizDraftCreateRequest(
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val count: Int,
    val instruction: String?,
) {
    fun toApplicationRequest() =
        AdminQuizDraftRequest(
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
            val tag =
                payload.textValue("tag")
                    ?.let(GrammarTag::fromDatabaseOrNull)
                    ?: return null
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
            return AdminQuizDraftCreateRequest(tag, difficulty, count, instruction)
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
                if (choice.has("id")) {
                    val id = choice.textValue("id") ?: return null
                    if (!id.isOpaqueEntityId()) {
                        return null
                    }
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

data class AdminQuizDraftGenerationResponse(
    val drafts: List<AdminQuizDraftResponse>,
)

data class AdminQuizDraftResponse(
    val id: String,
    val tag: String,
    val difficulty: String,
    val questionEn: String,
    val sentenceKo: String,
    val choices: List<AdminQuizDraftChoiceResponse>,
    val answerExplanationEn: String,
) {
    companion object {
        fun from(draft: AdminQuizDraft) =
            AdminQuizDraftResponse(
                id = draft.id.toString(),
                tag = draft.content.tag.databaseValue,
                difficulty = draft.content.difficulty.databaseValue,
                questionEn = draft.content.questionEn,
                sentenceKo = draft.content.sentenceKo,
                choices =
                    draft.content.choices
                        .sortedBy(QuizChoiceContent::sortOrder)
                        .map(AdminQuizDraftChoiceResponse::from),
                answerExplanationEn = draft.content.answerExplanationEn,
            )
    }
}

data class AdminQuizDraftChoiceResponse(
    val text: String,
    val isCorrect: Boolean,
) {
    companion object {
        fun from(choice: QuizChoiceContent) =
            AdminQuizDraftChoiceResponse(
                text = choice.text,
                isCorrect = choice.correct,
            )
    }
}

data class AdminQuizUpdateResponse(
    val quiz: AdminQuizStatusResponse,
)

data class AdminQuizStatusResponse(
    val id: String,
    val status: String,
) {
    companion object {
        fun from(result: QuizCommandResult.Success) =
            AdminQuizStatusResponse(
                id = result.quizId.toString(),
                status = result.status.databaseValue,
            )
    }
}

data class AdminQuizDeleteResponse(
    val deletedQuizId: String,
)

class AdminQuizInvalidRequestException(
    message: String,
) : RuntimeException(message)

class AdminQuizUnavailableException(
    val publicMessage: String,
    cause: Throwable,
) : RuntimeException(publicMessage, cause)

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

private fun String.toPositiveLongOrNull(): Long? =
    takeIf { it.matches(POSITIVE_LONG) }?.toLongOrNull()?.takeIf { it > 0 }

private fun String.isOpaqueEntityId(): Boolean =
    matches(POSITIVE_LONG) || matches(UUID)

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
private val ADMIN_UPDATE_STATUSES = setOf(QuizStatus.DRAFT, QuizStatus.APPROVED)
private val POSITIVE_LONG = Regex("[1-9]\\d*")
private val UUID =
    Regex(
        "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}",
    )
