package io.github.dobbylee.cherryk.presentation.ocr

import io.github.dobbylee.cherryk.application.ocr.OcrApplicationException
import io.github.dobbylee.cherryk.application.usage.UsageLimitExceededException
import io.github.dobbylee.cherryk.presentation.ApiErrorResponse
import io.github.dobbylee.cherryk.presentation.apiError
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MaxUploadSizeExceededException
import org.springframework.web.multipart.MultipartException

@RestControllerAdvice(assignableTypes = [OcrController::class])
class OcrExceptionHandler {
    @ExceptionHandler(OcrAuthenticationException::class)
    fun authenticationRequired(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.UNAUTHORIZED,
            "unauthorized",
            "Authentication required.",
        )

    @ExceptionHandler(OcrInvalidRequestException::class)
    fun invalidRequest(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_request",
            "Request body must be form data.",
        )

    @ExceptionHandler(OcrAuthenticationUnavailableException::class)
    fun authenticationUnavailable(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "server_error",
            "Authentication is unavailable.",
        )

    @ExceptionHandler(OcrApplicationException::class)
    fun invalidImage(exception: OcrApplicationException): ResponseEntity<ApiErrorResponse> =
        errorResponse(HttpStatus.BAD_REQUEST, exception.code, exception.message.orEmpty())

    @ExceptionHandler(UsageLimitExceededException::class)
    fun usageLimitExceeded(
        exception: UsageLimitExceededException,
    ): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.TOO_MANY_REQUESTS,
            exception.code,
            exception.message.orEmpty(),
        )

    @ExceptionHandler(MaxUploadSizeExceededException::class)
    fun imageTooLarge(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_image",
            "Image must be 5 MB or smaller.",
        )

    @ExceptionHandler(MultipartException::class)
    fun invalidMultipartRequest(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.BAD_REQUEST,
            "invalid_request",
            "Request body must be form data.",
        )

    @ExceptionHandler(OcrUnavailableException::class)
    fun unavailable(): ResponseEntity<ApiErrorResponse> =
        errorResponse(
            HttpStatus.INTERNAL_SERVER_ERROR,
            "server_error",
            "OCR is unavailable.",
        )

    private fun errorResponse(
        status: HttpStatus,
        code: String,
        message: String,
    ) = ResponseEntity.status(status).body(apiError(code, message))
}
