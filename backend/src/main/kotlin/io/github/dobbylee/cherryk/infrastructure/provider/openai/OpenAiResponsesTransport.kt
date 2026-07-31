package io.github.dobbylee.cherryk.infrastructure.provider.openai

import org.springframework.http.MediaType
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException
import java.net.SocketTimeoutException
import java.net.http.HttpTimeoutException
import java.time.Duration

internal class OpenAiResponsesTransport(
    private val restClient: RestClient,
) {
    fun execute(
        apiKey: String,
        request: Map<String, Any>,
    ): String {
        val response =
            try {
                restClient
                    .post()
                    .uri(RESPONSES_URL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer $apiKey")
                    .body(request)
                    .retrieve()
                    .body(OpenAiResponse::class.java)
            } catch (exception: RestClientResponseException) {
                throw OpenAiResponseFailure(
                    kind = OpenAiResponseFailureKind.HTTP_STATUS,
                    statusCode = exception.statusCode.value(),
                )
            } catch (exception: ResourceAccessException) {
                throw OpenAiResponseFailure(
                    kind =
                        if (exception.hasTimeoutCause()) {
                            OpenAiResponseFailureKind.TIMEOUT
                        } else {
                            OpenAiResponseFailureKind.REQUEST_FAILED
                        },
                )
            } catch (exception: RestClientException) {
                throw OpenAiResponseFailure(OpenAiResponseFailureKind.INVALID_RESPONSE)
            }

        if (response?.status != "completed") {
            throw OpenAiResponseFailure(OpenAiResponseFailureKind.INCOMPLETE)
        }
        if (response.output.flatMap(OpenAiOutputItem::content).any { it.type == "refusal" }) {
            throw OpenAiResponseFailure(OpenAiResponseFailureKind.REFUSAL)
        }
        return response.output
            .asSequence()
            .flatMap { it.content.asSequence() }
            .firstOrNull { it.type == "output_text" && !it.text.isNullOrBlank() }
            ?.text
            ?: throw OpenAiResponseFailure(OpenAiResponseFailureKind.INCOMPLETE)
    }
}

internal enum class OpenAiResponseFailureKind {
    HTTP_STATUS,
    TIMEOUT,
    REQUEST_FAILED,
    INVALID_RESPONSE,
    INCOMPLETE,
    REFUSAL,
}

internal class OpenAiResponseFailure(
    val kind: OpenAiResponseFailureKind,
    val statusCode: Int? = null,
) : RuntimeException()

internal data class OpenAiReasoning(
    val effort: String,
)

internal data class OpenAiText(
    val format: Map<String, Any>,
)

internal fun waitBeforeOpenAiRetry(
    delay: Duration,
    interruptedFailure: () -> RuntimeException,
) {
    try {
        Thread.sleep(delay)
    } catch (exception: InterruptedException) {
        Thread.currentThread().interrupt()
        throw interruptedFailure()
    }
}

private data class OpenAiResponse(
    val status: String? = null,
    val output: List<OpenAiOutputItem> = emptyList(),
)

private data class OpenAiOutputItem(
    val content: List<OpenAiContentPart> = emptyList(),
)

private data class OpenAiContentPart(
    val type: String? = null,
    val text: String? = null,
)

private fun ResourceAccessException.hasTimeoutCause(): Boolean =
    generateSequence(cause) { it.cause }
        .any { it is SocketTimeoutException || it is HttpTimeoutException }

private const val RESPONSES_URL = "https://api.openai.com/v1/responses"
