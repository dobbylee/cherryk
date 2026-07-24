package io.github.dobbylee.cherryk.application.ocr

data class OcrUpload(
    val bytes: ByteArray,
    val declaredContentType: String?,
)

fun interface OcrUsageLimiter {
    fun reserve(userId: Long)
}

class OcrApplicationService(
    private val imageNormalizer: OcrImageNormalizer,
    private val usageLimiter: OcrUsageLimiter,
    private val provider: OcrProvider,
) {
    fun extract(
        userId: Long,
        upload: OcrUpload,
    ): OcrResult {
        validate(upload)
        val normalizedImage =
            try {
                imageNormalizer.normalize(upload.bytes)
            } catch (exception: OcrImageNormalizationException) {
                throw OcrApplicationException(
                    code = "invalid_image",
                    message =
                        if (exception.reason == OcrImageNormalizationFailure.INVALID_FORMAT) {
                            "Upload a valid JPEG, PNG, or WebP image."
                        } else {
                            "Image could not be processed."
                        },
                    cause = exception,
                )
            }

        usageLimiter.reserve(userId)

        val result =
            try {
                provider.extract(normalizedImage)
            } catch (exception: OcrProviderException) {
                if (exception.code == "empty_result") {
                    return OcrResult(extractedText = "", note = OCR_NO_TEXT_NOTE)
                }
                throw exception
            }
        return normalizeResult(result)
    }

    private fun validate(upload: OcrUpload) {
        if (upload.bytes.isEmpty()) {
            throw OcrApplicationException("invalid_image", "Image file is required.")
        }
        if (upload.bytes.size > MAX_OCR_IMAGE_BYTES) {
            throw OcrApplicationException("invalid_image", "Image must be 5 MB or smaller.")
        }
        if (
            !upload.declaredContentType.isNullOrBlank() &&
            !upload.declaredContentType.startsWith("image/", ignoreCase = true)
        ) {
            throw OcrApplicationException("invalid_image", "Upload an image file.")
        }
    }

    private fun normalizeResult(result: OcrResult): OcrResult {
        val note = result.note?.trim()?.takeIf(String::isNotEmpty)
        if (note == null) {
            return if (result.extractedText.isBlank()) {
                OcrResult(extractedText = result.extractedText, note = OCR_NO_TEXT_NOTE)
            } else {
                OcrResult(extractedText = result.extractedText)
            }
        }
        if (!note.isPredominantlyKorean()) {
            return OcrResult(extractedText = result.extractedText, note = note)
        }
        return OcrResult(
            extractedText = result.extractedText,
            note = if (result.extractedText.isBlank()) OCR_NO_TEXT_NOTE else OCR_REVIEW_NOTE,
        )
    }
}

class OcrApplicationException(
    val code: String,
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

private fun String.isPredominantlyKorean(): Boolean {
    val hangulCount = count { it in '\u3131'..'\u318E' || it in '\uAC00'..'\uD7A3' }
    val latinCount = count { it in 'A'..'Z' || it in 'a'..'z' }
    return hangulCount > 0 && hangulCount >= latinCount
}

const val MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024

private const val OCR_REVIEW_NOTE =
    "Some characters could not be read with confidence. Please review and edit the extracted text."
private const val OCR_NO_TEXT_NOTE =
    "No readable Korean text was found. Please try another image or enter the text manually."
