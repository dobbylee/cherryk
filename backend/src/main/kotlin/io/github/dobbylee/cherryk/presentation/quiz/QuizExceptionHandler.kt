package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.QuizAttemptFailure
import io.github.dobbylee.cherryk.presentation.ApiErrorResponse
import io.github.dobbylee.cherryk.presentation.apiError
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice(assignableTypes = [QuizController::class])
class QuizExceptionHandler {
    @ExceptionHandler(QuizAuthenticationException::class)
    fun authenticationRequired(): ResponseEntity<ApiErrorResponse> =
        errorResponse(HttpStatus.UNAUTHORIZED, "unauthorized", "Authentication required.")

    @ExceptionHandler(QuizAuthenticationUnavailableException::class)
    fun authenticationUnavailable(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "server_error",
            "Authentication is unavailable.",
        )

    @ExceptionHandler(
        HttpMessageNotReadableException::class,
        HttpMediaTypeNotSupportedException::class,
    )
    fun requestBodyMustBeJson(): ResponseEntity<ApiErrorResponse> =
        errorResponse(HttpStatus.BAD_REQUEST, "invalid_request", "Request body must be JSON.")

    @ExceptionHandler(QuizInvalidRequestException::class)
    fun invalidRequest(
        exception: QuizInvalidRequestException,
    ): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_request",
            exception.message.orEmpty(),
        )

    @ExceptionHandler(QuizAttemptRejectedException::class)
    fun attemptRejected(
        exception: QuizAttemptRejectedException,
    ): ResponseEntity<ApiErrorResponse> =
        when (exception.reason) {
            QuizAttemptFailure.QUIZ_NOT_AVAILABLE ->
                errorResponse(
                    HttpStatus.NOT_FOUND,
                    "quiz_not_available",
                    "Quiz is not available.",
                )
            QuizAttemptFailure.INVALID_CHOICE ->
                errorResponse(
                    HttpStatus.BAD_REQUEST,
                    "invalid_choice",
                    "Selected choice is invalid.",
                )
        }

    @ExceptionHandler(QuizUnavailableException::class)
    fun unavailable(
        exception: QuizUnavailableException,
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
