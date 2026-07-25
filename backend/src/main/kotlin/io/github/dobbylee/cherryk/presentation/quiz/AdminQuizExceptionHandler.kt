package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.AdminQuizApplicationException
import io.github.dobbylee.cherryk.presentation.ApiErrorResponse
import io.github.dobbylee.cherryk.presentation.apiError
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice(assignableTypes = [AdminQuizController::class])
class AdminQuizExceptionHandler {
    @ExceptionHandler(
        HttpMessageNotReadableException::class,
        HttpMediaTypeNotSupportedException::class,
    )
    fun requestBodyMustBeJson(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_request",
            "Request body must be JSON.",
        )

    @ExceptionHandler(AdminQuizInvalidRequestException::class)
    fun invalidRequest(
        exception: AdminQuizInvalidRequestException,
    ): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_request",
            exception.message.orEmpty(),
        )

    @ExceptionHandler(AdminQuizApplicationException::class)
    fun applicationError(
        exception: AdminQuizApplicationException,
    ): ResponseEntity<ApiErrorResponse> {
        val status =
            when (exception.code) {
                "invalid_ai_output" -> HttpStatus.BAD_GATEWAY
                "quiz_not_found" -> HttpStatus.NOT_FOUND
                "quiz_not_editable",
                "quiz_duplicate",
                "quiz_revision_invalid",
                -> HttpStatus.CONFLICT
                else -> HttpStatus.INTERNAL_SERVER_ERROR
            }
        return errorResponse(status, exception.code, exception.message.orEmpty())
    }

    @ExceptionHandler(AdminQuizUnavailableException::class)
    fun unavailable(
        exception: AdminQuizUnavailableException,
    ): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "server_error",
            exception.publicMessage,
        )

    private fun errorResponse(
        status: HttpStatus,
        code: String,
        message: String,
    ) = ResponseEntity.status(status).body(apiError(code, message))
}
