package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.correction.CorrectionMistake
import io.github.dobbylee.cherryk.application.correction.CorrectionProvider
import io.github.dobbylee.cherryk.application.correction.CorrectionProviderException
import io.github.dobbylee.cherryk.application.correction.CorrectionProviderInput
import io.github.dobbylee.cherryk.application.correction.CorrectionResult
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.springframework.http.MediaType
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import org.springframework.web.client.RestClientResponseException
import tools.jackson.databind.ObjectMapper
import tools.jackson.module.kotlin.readValue
import java.net.SocketTimeoutException
import java.net.http.HttpTimeoutException
import java.time.Duration

class OpenAiCorrectionProvider internal constructor(
    private val restClient: RestClient,
    private val properties: OpenAiCorrectionProperties,
    private val objectMapper: ObjectMapper,
    private val retryWaiter: (Duration) -> Unit = ::waitBeforeRetry,
) : CorrectionProvider {
    override fun correct(input: CorrectionProviderInput): CorrectionResult {
        requireConfigured()
        val request =
            mutableMapOf<String, Any>(
                "model" to properties.model,
                "instructions" to CORRECTION_INSTRUCTIONS,
                "input" to
                    objectMapper.writeValueAsString(
                        OpenAiCorrectionInput(
                            text = input.text,
                            level = input.level.databaseValue,
                        ),
                    ),
                "store" to false,
                "text" to OpenAiText(format = OpenAiCorrectionSchema.format),
            )
        properties.reasoningEffort
            .takeIf(String::isNotBlank)
            ?.let { request["reasoning"] = OpenAiReasoning(it) }

        repeat(properties.maxAttempts) { attempt ->
            try {
                return execute(request)
            } catch (exception: CorrectionProviderException) {
                if (!exception.retryable || attempt == properties.maxAttempts - 1) {
                    throw exception
                }
                retryWaiter(properties.retryDelay)
            }
        }
        error("OpenAI correction retry loop completed unexpectedly.")
    }

    private fun execute(request: Map<String, Any>): CorrectionResult {
        val response =
            try {
                restClient
                    .post()
                    .uri(RESPONSES_URL)
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer ${properties.apiKey}")
                    .body(request)
                    .retrieve()
                    .body(OpenAiResponse::class.java)
            } catch (exception: RestClientResponseException) {
                val retryable =
                    exception.statusCode.is5xxServerError ||
                        exception.statusCode.value() == 429
                throw CorrectionProviderException(
                    code = "request_failed",
                    message = "OpenAI correction request failed with status ${exception.statusCode.value()}.",
                    retryable = retryable,
                )
            } catch (exception: ResourceAccessException) {
                val timedOut = exception.hasTimeoutCause()
                throw CorrectionProviderException(
                    code = if (timedOut) "timeout" else "request_failed",
                    message =
                        if (timedOut) {
                            "OpenAI correction request timed out."
                        } else {
                            "OpenAI correction request could not be completed."
                        },
                    retryable = !timedOut,
                )
            } catch (exception: RestClientException) {
                throw CorrectionProviderException(
                    code = "invalid_response",
                    message = "OpenAI correction response could not be parsed.",
                )
            }

        if (response?.status != "completed") {
            throw invalidResponse()
        }
        if (response.output.flatMap(OpenAiOutputItem::content).any { it.type == "refusal" }) {
            throw CorrectionProviderException(
                code = "invalid_response",
                message = "OpenAI correction request was refused.",
            )
        }
        val outputText =
            response.output
                .asSequence()
                .flatMap { it.content.asSequence() }
                .firstOrNull { it.type == "output_text" && !it.text.isNullOrBlank() }
                ?.text
                ?: throw invalidResponse()

        return parseOutput(outputText)
    }

    private fun parseOutput(outputText: String): CorrectionResult {
        val output =
            try {
                objectMapper.readValue<OpenAiCorrectionOutput>(outputText)
            } catch (exception: RuntimeException) {
                throw CorrectionProviderException(
                    code = "invalid_response",
                    message = "OpenAI correction output was not valid JSON.",
                )
            }

        return try {
            CorrectionResult(
                correctedText = output.correctedText,
                explanationEn = output.explanationEn,
                mistakes =
                    output.mistakes.map { mistake ->
                        CorrectionMistake(
                            tag = GrammarTag.fromDatabase(mistake.tag),
                            originalPart = mistake.originalPart,
                            correctedPart = mistake.correctedPart,
                            explanationEn = mistake.explanationEn,
                            severity = MistakeSeverity.fromDatabase(mistake.severity),
                        )
                    },
            )
        } catch (exception: IllegalArgumentException) {
            throw CorrectionProviderException(
                code = "invalid_response",
                message = "OpenAI correction output did not match the required schema.",
            )
        }
    }

    private fun requireConfigured() {
        if (properties.apiKey.isBlank() || properties.model.isBlank()) {
            throw CorrectionProviderException(
                code = "not_configured",
                message = "OpenAI correction is not configured.",
            )
        }
    }

    private fun invalidResponse() =
        CorrectionProviderException(
            code = "invalid_response",
            message = "OpenAI correction response did not include completed output text.",
        )
}

private data class OpenAiReasoning(
    val effort: String,
)

private data class OpenAiText(
    val format: Map<String, Any>,
)

private data class OpenAiCorrectionInput(
    val text: String,
    val level: String,
    val correctionStyle: String = "minimal",
)

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

private data class OpenAiCorrectionOutput(
    val correctedText: String,
    val explanationEn: String,
    val mistakes: List<OpenAiCorrectionMistake>,
)

private data class OpenAiCorrectionMistake(
    val tag: String,
    val originalPart: String,
    val correctedPart: String,
    val explanationEn: String,
    val severity: String,
)

private object OpenAiCorrectionSchema {
    private val mistakeSchema: Map<String, Any> =
        mapOf(
            "type" to "object",
            "additionalProperties" to false,
            "required" to
                listOf(
                    "tag",
                    "originalPart",
                    "correctedPart",
                    "explanationEn",
                    "severity",
                ),
            "properties" to
                mapOf(
                    "tag" to
                        mapOf(
                            "type" to "string",
                            "enum" to GrammarTag.entries.map(GrammarTag::databaseValue),
                        ),
                    "originalPart" to mapOf("type" to "string"),
                    "correctedPart" to mapOf("type" to "string"),
                    "explanationEn" to mapOf("type" to "string"),
                    "severity" to
                        mapOf(
                            "type" to "string",
                            "enum" to MistakeSeverity.entries.map(MistakeSeverity::databaseValue),
                        ),
                ),
        )

    private val outputSchema: Map<String, Any> =
        mapOf(
            "type" to "object",
            "additionalProperties" to false,
            "required" to listOf("correctedText", "explanationEn", "mistakes"),
            "properties" to
                mapOf(
                    "correctedText" to mapOf("type" to "string"),
                    "explanationEn" to mapOf("type" to "string"),
                    "mistakes" to
                        mapOf(
                            "type" to "array",
                            "items" to mistakeSchema,
                        ),
                ),
        )

    val format: Map<String, Any> =
        mapOf(
            "type" to "json_schema",
            "name" to "korean_correction",
            "strict" to true,
            "schema" to outputSchema,
        )
}

private fun ResourceAccessException.hasTimeoutCause(): Boolean =
    generateSequence(cause) { it.cause }
        .any { it is SocketTimeoutException || it is HttpTimeoutException }

private fun waitBeforeRetry(delay: Duration) {
    try {
        Thread.sleep(delay)
    } catch (exception: InterruptedException) {
        Thread.currentThread().interrupt()
        throw CorrectionProviderException(
            code = "request_failed",
            message = "OpenAI correction retry was interrupted.",
        )
    }
}

private val CORRECTION_INSTRUCTIONS =
    listOf(
        "You correct Korean learner writing.",
        "Preserve meaning and make the smallest correction that fixes real errors.",
        "Do not over-correct natural casual Korean.",
        "Preserve line breaks and paragraph breaks. Do not treat layout-only line-break changes as mistakes.",
        "correctedText must be Korean and must never be an English translation.",
        "Each mistake must describe a real change: originalPart and correctedPart must differ and must match the relevant source and corrected text exactly.",
        "Return English explanations and tags only from the allowed enum.",
    ).joinToString("\n")

private const val RESPONSES_URL = "https://api.openai.com/v1/responses"
