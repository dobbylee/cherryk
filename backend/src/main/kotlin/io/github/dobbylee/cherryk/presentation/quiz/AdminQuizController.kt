package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.AdminQuizApplicationException
import io.github.dobbylee.cherryk.application.quiz.AdminQuizApplicationService
import org.springframework.http.MediaType
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
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
    @GetMapping(
        "/tag-counts",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun getTagCounts(): AdminQuizTagCountsResponse {
        val counts =
            try {
                service.getTagCounts()
            } catch (exception: RuntimeException) {
                throw AdminQuizUnavailableException("Quiz counts are unavailable.", exception)
            }
        return AdminQuizTagCountsResponse(
            tagCounts = counts.map(AdminQuizTagCountResponse::from),
        )
    }

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

class AdminQuizInvalidRequestException(
    message: String,
) : RuntimeException(message)

class AdminQuizUnavailableException(
    val publicMessage: String,
    cause: Throwable,
) : RuntimeException(publicMessage, cause)

private fun String.toPositiveLongOrNull(): Long? =
    takeIf { it.matches(POSITIVE_LONG) }?.toLongOrNull()?.takeIf { it > 0 }

private val POSITIVE_LONG = Regex("[1-9]\\d*")
