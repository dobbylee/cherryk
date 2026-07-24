package io.github.dobbylee.cherryk.application.ocr

enum class OcrImageFormat(
    val clovaValue: String,
) {
    JPEG("jpg"),
    PNG("png"),
}

data class OcrImage(
    val bytes: ByteArray,
    val format: OcrImageFormat,
)

data class OcrResult(
    val extractedText: String,
    val note: String? = null,
)

fun interface OcrProvider {
    fun extract(image: OcrImage): OcrResult
}

class OcrProviderException(
    val code: String,
    message: String,
    internal val retryable: Boolean = false,
) : RuntimeException(message)
