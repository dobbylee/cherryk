package io.github.dobbylee.cherryk.application.ocr

fun interface OcrImageNormalizer {
    fun normalize(bytes: ByteArray): OcrImage
}

class OcrImageNormalizationException(
    val reason: OcrImageNormalizationFailure,
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

enum class OcrImageNormalizationFailure {
    INVALID_FORMAT,
    PROCESSING_FAILED,
}
