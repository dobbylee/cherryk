package io.github.dobbylee.cherryk.presentation

data class ApiErrorResponse(
    val error: ApiErrorBody,
)

data class ApiErrorBody(
    val code: String,
    val message: String,
)

fun apiError(
    code: String,
    message: String,
) = ApiErrorResponse(error = ApiErrorBody(code = code, message = message))
