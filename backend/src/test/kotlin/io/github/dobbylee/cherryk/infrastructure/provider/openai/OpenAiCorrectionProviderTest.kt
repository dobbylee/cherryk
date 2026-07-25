package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.correction.CorrectionProviderException
import io.github.dobbylee.cherryk.application.correction.CorrectionProviderInput
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.hamcrest.Matchers.containsString
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.mock.http.client.MockClientHttpRequest
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.net.SocketTimeoutException
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class OpenAiCorrectionProviderTest {
    private val objectMapper = jacksonObjectMapper()
    private val retryWaits = mutableListOf<Duration>()
    private lateinit var server: MockRestServiceServer
    private lateinit var provider: OpenAiCorrectionProvider

    @BeforeEach
    fun setUp() {
        val builder = RestClient.builder()
        server = MockRestServiceServer.bindTo(builder).build()
        provider =
            OpenAiCorrectionProvider(
                restClient = builder.build(),
                properties = properties(reasoningEffort = "low"),
                objectMapper = objectMapper,
                retryWaiter = retryWaits::add,
            )
    }

    @Test
    fun `sends the stateless strict structured-output contract and parses correction`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer test-key"))
            .andExpect(content().string(containsString(""""model":"test-model"""")))
            .andExpect(content().string(containsString(""""reasoning":{"effort":"low"}""")))
            .andExpect(content().string(containsString(""""store":false""")))
            .andExpect(content().string(containsString(""""correctionStyle\":\"minimal\"""")))
            .andExpect(content().string(containsString(""""level\":\"beginner\"""")))
            .andExpect { request ->
                val requestJson =
                    objectMapper.readTree((request as MockClientHttpRequest).bodyAsString)
                assertEquals(
                    objectMapper.readTree(EXPECTED_CORRECTION_FORMAT),
                    requestJson["text"]["format"],
                )
            }
            .andRespond(
                withSuccess(
                    response(
                        """
                        {
                          "correctedText": "저는 학교에 가요.",
                          "explanationEn": "Use the destination particle.",
                          "mistakes": [{
                            "tag": "particle_location",
                            "originalPart": "학교를",
                            "correctedPart": "학교에",
                            "explanationEn": "Use 에 for a destination.",
                            "severity": "minor"
                          }]
                        }
                        """.trimIndent(),
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result = provider.correct(input())

        assertEquals("저는 학교에 가요.", result.correctedText)
        assertEquals(GrammarTag.PARTICLE_LOCATION, result.mistakes.single().tag)
        assertEquals(MistakeSeverity.MINOR, result.mistakes.single().severity)
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `retries a transient response once with the same request`() {
        repeat(2) { attempt ->
            server
                .expect(requestTo(RESPONSES_URL))
                .andExpect(content().string(containsString("저는 학교를 가요.")))
                .andRespond(
                    if (attempt == 0) {
                        withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                    } else {
                        withSuccess(response(validOutput()), MediaType.APPLICATION_JSON)
                    },
                )
        }

        val result = provider.correct(input())

        assertEquals("저는 학교에 가요.", result.correctedText)
        assertEquals(listOf(Duration.ofMillis(200)), retryWaits)
        server.verify()
    }

    @Test
    fun `does not retry a non-transient client response`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andRespond(withStatus(HttpStatus.BAD_REQUEST))

        val exception =
            assertFailsWith<CorrectionProviderException> {
                provider.correct(input())
            }

        assertEquals("request_failed", exception.code)
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `bounds timeout retries and returns a stable timeout error`() {
        repeat(2) {
            server
                .expect(requestTo(RESPONSES_URL))
                .andRespond {
                    throw ResourceAccessException(
                        "Do not expose this transport message.",
                        SocketTimeoutException(),
                    )
                }
        }

        val exception =
            assertFailsWith<CorrectionProviderException> {
                provider.correct(input())
            }

        assertEquals("timeout", exception.code)
        assertEquals("OpenAI correction request timed out.", exception.message)
        assertEquals(listOf(Duration.ofMillis(200)), retryWaits)
        server.verify()
    }

    @Test
    fun `rejects refusals incomplete responses invalid JSON and invalid enums without retry`() {
        val responses =
            listOf(
                """
                {
                  "status": "completed",
                  "output": [{
                    "content": [{"type": "refusal", "refusal": "No."}]
                  }]
                }
                """.trimIndent(),
                """{"status":"incomplete","output":[]}""",
                response("not JSON"),
                response(
                    """
                    {
                      "correctedText": "저는 학교에 가요.",
                      "explanationEn": "Use the destination particle.",
                      "mistakes": [{
                        "tag": "invented_tag",
                        "originalPart": "학교를",
                        "correctedPart": "학교에",
                        "explanationEn": "Use 에 for a destination.",
                        "severity": "minor"
                      }]
                    }
                    """.trimIndent(),
                ),
            )

        responses.forEach { responseBody ->
            server
                .expect(requestTo(RESPONSES_URL))
                .andRespond(withSuccess(responseBody, MediaType.APPLICATION_JSON))
        }

        responses.indices.forEach {
            val exception =
                assertFailsWith<CorrectionProviderException> {
                    provider.correct(input())
                }
            assertEquals("invalid_response", exception.code)
        }
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `fails before HTTP when required configuration is missing`() {
        val unconfigured =
            OpenAiCorrectionProvider(
                restClient = RestClient.create(),
                properties = properties(apiKey = ""),
                objectMapper = objectMapper,
            )

        val exception =
            assertFailsWith<CorrectionProviderException> {
                unconfigured.correct(input())
            }

        assertEquals("not_configured", exception.code)
        assertEquals("OpenAI correction is not configured.", exception.message)
    }

    private fun input() =
        CorrectionProviderInput(
            text = "저는 학교를 가요.",
            level = UserLevel.BEGINNER,
        )

    private fun properties(
        apiKey: String = "test-key",
        reasoningEffort: String = "",
    ) = OpenAiCorrectionProperties(
        apiKey = apiKey,
        model = "test-model",
        reasoningEffort = reasoningEffort,
        timeout = Duration.ofSeconds(10),
        maxAttempts = 2,
        retryDelay = Duration.ofMillis(200),
    )

    private fun response(output: String): String =
        """
        {
          "status": "completed",
          "output": [{
            "type": "message",
            "content": [{
              "type": "output_text",
              "text": ${objectMapper.writeValueAsString(output)}
            }]
          }]
        }
        """.trimIndent()

    private fun validOutput() =
        """
        {
          "correctedText": "저는 학교에 가요.",
          "explanationEn": "Use the destination particle.",
          "mistakes": []
        }
        """.trimIndent()

    private companion object {
        const val RESPONSES_URL = "https://api.openai.com/v1/responses"
        val EXPECTED_CORRECTION_FORMAT =
            """
            {
              "type": "json_schema",
              "name": "korean_correction",
              "strict": true,
              "schema": {
                "type": "object",
                "additionalProperties": false,
                "required": ["correctedText", "explanationEn", "mistakes"],
                "properties": {
                  "correctedText": {"type": "string"},
                  "explanationEn": {"type": "string"},
                  "mistakes": {
                    "type": "array",
                    "items": {
                      "type": "object",
                      "additionalProperties": false,
                      "required": [
                        "tag",
                        "originalPart",
                        "correctedPart",
                        "explanationEn",
                        "severity"
                      ],
                      "properties": {
                        "tag": {
                          "type": "string",
                          "enum": [
                            "particle_subject",
                            "particle_topic",
                            "particle_object",
                            "particle_location",
                            "verb_conjugation",
                            "honorific",
                            "spacing",
                            "word_choice",
                            "sentence_order",
                            "missing_word",
                            "unnatural"
                          ]
                        },
                        "originalPart": {"type": "string"},
                        "correctedPart": {"type": "string"},
                        "explanationEn": {"type": "string"},
                        "severity": {
                          "type": "string",
                          "enum": ["minor", "major"]
                        }
                      }
                    }
                  }
                }
              }
            }
            """.trimIndent()
    }
}
