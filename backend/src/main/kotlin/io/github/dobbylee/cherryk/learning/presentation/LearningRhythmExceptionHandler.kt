package io.github.dobbylee.cherryk.learning.presentation

import io.github.dobbylee.cherryk.learning.application.InvalidLearningTimeZone
import io.github.dobbylee.cherryk.platform.web.apiError
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice

@RestControllerAdvice(assignableTypes = [LearningRhythmController::class])
class LearningRhythmExceptionHandler {
    @ExceptionHandler(LearningAuthenticationRequired::class)
    fun unauthorized() = ResponseEntity.status(HttpStatus.UNAUTHORIZED)
        .body(apiError("unauthorized", "Authentication required."))

    @ExceptionHandler(InvalidLearningTimeZone::class)
    fun invalidTimeZone() = ResponseEntity.badRequest()
        .body(apiError("invalid_request", "A supported IANA time zone is required."))

    @ExceptionHandler(RuntimeException::class)
    fun unavailable() = ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
        .body(apiError("server_error", "Learning activity is unavailable."))
}
