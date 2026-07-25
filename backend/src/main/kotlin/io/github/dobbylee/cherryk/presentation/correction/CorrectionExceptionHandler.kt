package io.github.dobbylee.cherryk.presentation.correction

import io.github.dobbylee.cherryk.application.correction.CorrectionOutputException
import io.github.dobbylee.cherryk.application.usage.UsageLimitExceededException
import io.github.dobbylee.cherryk.presentation.ApiErrorResponse
import io.github.dobbylee.cherryk.presentation.apiError
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.HttpMediaTypeNotSupportedException
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice(assignableTypes = [CorrectionController::class])
class CorrectionExceptionHandler {
    @ExceptionHandler(CorrectionAuthenticationException::class)
    fun authenticationRequired(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.UNAUTHORIZED,
            "unauthorized",
            "Authentication required.",
        )

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

    @ExceptionHandler(CorrectionInvalidRequestException::class)
    fun invalidRequest(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_request",
            "Correction request is invalid.",
        )

    @ExceptionHandler(CorrectionAuthenticationUnavailableException::class)
    fun authenticationUnavailable(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "server_error",
            "Authentication is unavailable.",
        )

    @ExceptionHandler(CorrectionOutputException::class)
    fun invalidOutput(
        exception: CorrectionOutputException,
    ): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_GATEWAY,
            exception.code,
            exception.message.orEmpty(),
        )

    @ExceptionHandler(UsageLimitExceededException::class)
    fun usageLimitExceeded(
        exception: UsageLimitExceededException,
    ): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.TOO_MANY_REQUESTS,
            exception.code,
            exception.message.orEmpty(),
        )

    @ExceptionHandler(CorrectionUnavailableException::class)
    fun unavailable(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "server_error",
            "Correction is unavailable.",
        )

    private fun errorResponse(
        status: HttpStatus,
        code: String,
        message: String,
    ) = ResponseEntity.status(status).body(apiError(code, message))
}
