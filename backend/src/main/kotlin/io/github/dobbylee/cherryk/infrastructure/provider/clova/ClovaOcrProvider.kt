package io.github.dobbylee.cherryk.infrastructure.provider.clova

import io.github.dobbylee.cherryk.application.ocr.OcrImage
import io.github.dobbylee.cherryk.application.ocr.OcrProvider
import io.github.dobbylee.cherryk.application.ocr.OcrResult
import org.springframework.http.MediaType
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException
import java.net.SocketTimeoutException
import java.net.URI
import java.net.URISyntaxException
import java.net.http.HttpTimeoutException
import java.time.Clock
import java.time.Duration
import java.util.Base64
import java.util.UUID

class ClovaOcrProvider internal constructor(
    private val restClient: RestClient,
    private val properties: ClovaOcrProperties,
    private val clock: Clock,
    private val requestIdFactory: () -> UUID = UUID::randomUUID,
    private val retryWaiter: (Duration) -> Unit = ::waitBeforeRetry,
) : OcrProvider {
    override fun extract(image: OcrImage): OcrResult {
        val invokeUri = configuredInvokeUri()
        val requestId = requestIdFactory().toString()
        val request =
            ClovaOcrRequest(
                requestId = requestId,
                timestamp = clock.millis(),
                images =
                    listOf(
                        ClovaOcrRequestImage(
                            format = image.format.clovaValue,
                            data = Base64.getEncoder().encodeToString(image.bytes),
                        ),
                    ),
            )

        repeat(properties.maxAttempts) { attempt ->
            try {
                return execute(invokeUri, request, requestId)
            } catch (exception: ClovaOcrProviderException) {
                if (!exception.retryable || attempt == properties.maxAttempts - 1) {
                    throw exception
                }
                retryWaiter(properties.retryDelay)
            }
        }
        error("CLOVA OCR retry loop completed unexpectedly.")
    }

    private fun execute(
        invokeUri: URI,
        request: ClovaOcrRequest,
        expectedRequestId: String,
    ): OcrResult {
        val response =
            try {
                restClient
                    .post()
                    .uri(invokeUri)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header(CLOVA_SECRET_HEADER, properties.secret)
                    .body(request)
                    .retrieve()
                    .body(ClovaOcrResponse::class.java)
            } catch (exception: RestClientResponseException) {
                val retryable =
                    exception.statusCode.is5xxServerError ||
                        exception.statusCode.value() == 429
                throw ClovaOcrProviderException(
                    code = "request_failed",
                    message = "CLOVA OCR request failed with status ${exception.statusCode.value()}.",
                    retryable = retryable,
                )
            } catch (exception: ResourceAccessException) {
                val timedOut = exception.hasTimeoutCause()
                throw ClovaOcrProviderException(
                    code = if (timedOut) "timeout" else "request_failed",
                    message =
                        if (timedOut) {
                            "CLOVA OCR request timed out."
                        } else {
                            "CLOVA OCR request could not be completed."
                        },
                    retryable = true,
                )
            } catch (exception: RestClientException) {
                throw ClovaOcrProviderException(
                    code = "invalid_response",
                    message = "CLOVA OCR response could not be parsed.",
                )
            }

        val image = response?.images?.singleOrNull()
        if (
            response == null ||
            response.version != CLOVA_VERSION ||
            response.requestId != expectedRequestId ||
            image == null
        ) {
            throw ClovaOcrProviderException(
                code = "invalid_response",
                message = "CLOVA OCR response did not match the request.",
            )
        }
        if (image.inferResult != CLOVA_SUCCESS) {
            throw ClovaOcrProviderException(
                code = "request_failed",
                message = "CLOVA OCR did not complete image recognition.",
            )
        }

        val extractedText = image.fields.toExtractedText()
        if (extractedText.isBlank()) {
            throw ClovaOcrProviderException(
                code = "empty_result",
                message = "CLOVA OCR did not find readable text.",
            )
        }
        return OcrResult(extractedText = extractedText)
    }

    private fun configuredInvokeUri(): URI {
        if (properties.invokeUrl.isBlank() || properties.secret.isBlank()) {
            throw ClovaOcrProviderException(
                code = "not_configured",
                message = "CLOVA OCR is not configured.",
            )
        }
        val uri =
            try {
                URI(properties.invokeUrl)
            } catch (exception: URISyntaxException) {
                throw invalidConfiguration()
            }
        if (
            !uri.isAbsolute ||
            !uri.scheme.equals("https", ignoreCase = true) ||
            uri.host.isNullOrBlank() ||
            uri.userInfo != null
        ) {
            throw invalidConfiguration()
        }
        return uri
    }

    private fun invalidConfiguration() =
        ClovaOcrProviderException(
            code = "not_configured",
            message = "CLOVA OCR invoke URL must be an absolute HTTPS URL.",
        )
}

class ClovaOcrProviderException(
    val code: String,
    message: String,
    internal val retryable: Boolean = false,
) : RuntimeException(message)

private data class ClovaOcrRequest(
    val version: String = CLOVA_VERSION,
    val requestId: String,
    val timestamp: Long,
    val lang: String = "ko",
    val images: List<ClovaOcrRequestImage>,
    val enableTableDetection: Boolean = false,
)

private data class ClovaOcrRequestImage(
    val format: String,
    val name: String = "cherryk-ocr",
    val data: String,
)

private data class ClovaOcrResponse(
    val version: String? = null,
    val requestId: String? = null,
    val images: List<ClovaOcrResponseImage> = emptyList(),
)

private data class ClovaOcrResponseImage(
    val inferResult: String? = null,
    val fields: List<ClovaOcrField> = emptyList(),
)

private data class ClovaOcrField(
    val inferText: String? = null,
    val lineBreak: Boolean = false,
)

private fun List<ClovaOcrField>.toExtractedText(): String =
    buildString {
        val readableFields = this@toExtractedText.filter { !it.inferText.isNullOrBlank() }
        readableFields.forEachIndexed { index, field ->
            append(field.inferText!!.trim())
            if (index < readableFields.lastIndex) {
                append(if (field.lineBreak) '\n' else ' ')
            }
        }
    }

private fun ResourceAccessException.hasTimeoutCause(): Boolean =
    generateSequence(cause) { it.cause }
        .any { it is SocketTimeoutException || it is HttpTimeoutException }

private fun waitBeforeRetry(delay: Duration) {
    try {
        Thread.sleep(delay)
    } catch (exception: InterruptedException) {
        Thread.currentThread().interrupt()
        throw ClovaOcrProviderException(
            code = "request_failed",
            message = "CLOVA OCR retry was interrupted.",
        )
    }
}

private const val CLOVA_SECRET_HEADER = "X-OCR-SECRET"
private const val CLOVA_SUCCESS = "SUCCESS"
private const val CLOVA_VERSION = "V2"
