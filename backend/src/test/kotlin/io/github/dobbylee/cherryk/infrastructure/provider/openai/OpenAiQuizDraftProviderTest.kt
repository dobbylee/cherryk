package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderException
import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderInput
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
import org.springframework.test.web.client.response.MockRestResponseCreators.withRawStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.net.SocketTimeoutException
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class OpenAiQuizDraftProviderTest {
    private val objectMapper = jacksonObjectMapper()
    private val retryWaits = mutableListOf<Duration>()
    private lateinit var server: MockRestServiceServer
    private lateinit var provider: OpenAiQuizDraftProvider

    @BeforeEach
    fun setUp() {
        val builder = RestClient.builder()
        server = MockRestServiceServer.bindTo(builder).build()
        provider =
            OpenAiQuizDraftProvider(
                restClient = builder.build(),
                properties = properties(reasoningEffort = "low"),
                objectMapper = objectMapper,
                retryWaiter = retryWaits::add,
                randomIndex = { 0 },
            )
    }

    @Test
    fun `requests separate answers and distractors then shuffles choices server-side`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("Authorization", "Bearer test-key"))
            .andExpect(content().string(containsString(""""model":"test-model"""")))
            .andExpect(content().string(containsString(""""reasoning":{"effort":"low"}""")))
            .andExpect(content().string(containsString(""""store":false""")))
            .andExpect { request ->
                val requestJson =
                    objectMapper.readTree((request as MockClientHttpRequest).bodyAsString)
                val providerInput = objectMapper.readTree(requestJson["input"].asText())
                assertEquals("particle_object", providerInput["tag"].asText())
                assertEquals("beginner", providerInput["difficulty"].asText())
                assertEquals(1, providerInput["count"].asInt())
                assertEquals("Use food vocabulary.", providerInput["instruction"].asText())
                assertEquals(
                    objectMapper.readTree(EXPECTED_QUIZ_FORMAT),
                    requestJson["text"]["format"],
                )
                assertTrue(
                    requestJson["instructions"]
                        .asText()
                        .contains("one correctAnswer and exactly three"),
                )
            }
            .andRespond(
                withSuccess(
                    response(validOutput()),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result =
            provider.generate(
                input(instruction = "Use food vocabulary."),
            )

        val quiz = result.single()
        assertEquals(GrammarTag.PARTICLE_OBJECT, quiz.tag)
        assertEquals(UserLevel.BEGINNER, quiz.difficulty)
        assertEquals("Choose the correct particle.", quiz.questionEn)
        assertEquals("저는 사과( ) 먹어요.", quiz.sentenceKo)
        assertEquals(listOf("은", "에", "이", "를"), quiz.choices.map { it.text })
        assertEquals(3, quiz.choices.single { it.correct }.sortOrder)
        assertEquals(
            "Correct answer: 를. Use 를 because 사과 is the object of 먹어요.",
            quiz.answerExplanationEn,
        )
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `rejects duplicate or missing answer choices`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andRespond(
                withSuccess(
                    response(
                        validOutput()
                            .replace(
                                """"distractors": ["은", "에", "이"]""",
                                """"distractors": ["은", "를", "이"]""",
                            ),
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        assertFailsWith<QuizDraftProviderException> {
            provider.generate(input())
        }.also { exception ->
            assertEquals("invalid_response", exception.code)
        }
        server.verify()
    }

    @Test
    fun `rejects a response with the wrong question count`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andRespond(withSuccess(response(validOutput()), MediaType.APPLICATION_JSON))

        assertFailsWith<QuizDraftProviderException> {
            provider.generate(input(count = 2))
        }.also { exception ->
            assertEquals("invalid_response", exception.code)
        }
    }

    @Test
    fun `retries one transient response with the same request`() {
        repeat(2) { attempt ->
            server
                .expect(requestTo(RESPONSES_URL))
                .andExpect(content().string(containsString("particle_object")))
                .andRespond(
                    if (attempt == 0) {
                        withStatus(HttpStatus.TOO_MANY_REQUESTS)
                    } else {
                        withSuccess(response(validOutput()), MediaType.APPLICATION_JSON)
                    },
                )
        }

        val result = provider.generate(input())

        assertEquals(1, result.size)
        assertEquals(listOf(Duration.ofMillis(25)), retryWaits)
        server.verify()
    }

    @Test
    fun `retries request timeout and conflict responses`() {
        listOf(HttpStatus.REQUEST_TIMEOUT, HttpStatus.CONFLICT).forEach { status ->
            val builder = RestClient.builder()
            val localServer = MockRestServiceServer.bindTo(builder).build()
            val waits = mutableListOf<Duration>()
            repeat(2) { attempt ->
                localServer
                    .expect(requestTo(RESPONSES_URL))
                    .andExpect(content().string(containsString("particle_object")))
                    .andRespond(
                        if (attempt == 0) {
                            withStatus(status)
                        } else {
                            withSuccess(response(validOutput()), MediaType.APPLICATION_JSON)
                        },
                    )
            }
            val localProvider =
                OpenAiQuizDraftProvider(
                    restClient = builder.build(),
                    properties = properties(),
                    objectMapper = objectMapper,
                    retryWaiter = waits::add,
                    randomIndex = { 0 },
                )

            assertEquals(1, localProvider.generate(input()).size)
            assertEquals(listOf(Duration.ofMillis(25)), waits)
            localServer.verify()
        }
    }

    @Test
    fun `does not retry a permanent or nonstandard response`() {
        val responses =
            listOf(
                withStatus(HttpStatus.BAD_REQUEST) to "request_failed",
                withRawStatus(600) to "invalid_response",
            )
        responses.forEach { (response, _) ->
            server
                .expect(requestTo(RESPONSES_URL))
                .andRespond(response)
        }

        responses.forEach { (_, expectedCode) ->
            assertFailsWith<QuizDraftProviderException> {
                provider.generate(input())
            }.also { exception ->
                assertEquals(expectedCode, exception.code)
                assertEquals(false, exception.retryable)
            }
        }
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `retries timeouts and returns a stable timeout error`() {
        val builder = RestClient.builder()
        val attempts = mutableListOf<Duration>()
        val timeoutProvider =
            OpenAiQuizDraftProvider(
                restClient =
                    builder
                        .requestInterceptor { _, _, _ ->
                            throw ResourceAccessException(
                                "timed out",
                                SocketTimeoutException("read timed out"),
                            )
                        }.build(),
                properties = properties(),
                objectMapper = objectMapper,
                retryWaiter = attempts::add,
            )

        assertFailsWith<QuizDraftProviderException> {
            timeoutProvider.generate(input())
        }.also { exception ->
            assertEquals("timeout", exception.code)
        }
        assertEquals(listOf(Duration.ofMillis(25)), attempts)
    }

    @Test
    fun `rejects refusals incomplete responses and invalid JSON`() {
        listOf(
            """{"status":"completed","output":[{"content":[{"type":"refusal"}]}]}""",
            """{"status":"incomplete","output":[]}""",
            "not-json",
            response("not-json"),
        ).forEach { body ->
            val builder = RestClient.builder()
            val localServer = MockRestServiceServer.bindTo(builder).build()
            localServer
                .expect(requestTo(RESPONSES_URL))
                .andRespond(withSuccess(body, MediaType.APPLICATION_JSON))
            val localProvider =
                OpenAiQuizDraftProvider(
                    restClient = builder.build(),
                    properties = properties(maxAttempts = 1),
                    objectMapper = objectMapper,
                )

            assertFailsWith<QuizDraftProviderException> {
                localProvider.generate(input())
            }.also { exception ->
                assertEquals("invalid_response", exception.code)
            }
            localServer.verify()
        }
    }

    @Test
    fun `requires configuration before making a request`() {
        val builder = RestClient.builder()
        val localServer = MockRestServiceServer.bindTo(builder).build()
        val localProvider =
            OpenAiQuizDraftProvider(
                restClient = builder.build(),
                properties = properties(apiKey = ""),
                objectMapper = objectMapper,
            )

        assertFailsWith<QuizDraftProviderException> {
            localProvider.generate(input())
        }.also { exception ->
            assertEquals("not_configured", exception.code)
        }
        localServer.verify()
    }

    @Test
    fun `validates provider settings`() {
        assertFailsWith<IllegalArgumentException> {
            properties(reasoningEffort = "extreme")
        }
        assertFailsWith<IllegalArgumentException> {
            properties(timeout = Duration.ZERO)
        }
        assertFailsWith<IllegalArgumentException> {
            properties(maxAttempts = 4)
        }
        assertFailsWith<IllegalArgumentException> {
            properties(retryDelay = Duration.ofMillis(-1))
        }
    }

    private fun input(
        count: Int = 1,
        instruction: String? = null,
    ) = QuizDraftProviderInput(
        tag = GrammarTag.PARTICLE_OBJECT,
        difficulty = UserLevel.BEGINNER,
        count = count,
        instruction = instruction,
    )

    private fun properties(
        apiKey: String = "test-key",
        reasoningEffort: String = "",
        timeout: Duration = Duration.ofSeconds(2),
        maxAttempts: Int = 2,
        retryDelay: Duration = Duration.ofMillis(25),
    ) = OpenAiQuizDraftProperties(
        apiKey = apiKey,
        model = "test-model",
        reasoningEffort = reasoningEffort,
        timeout = timeout,
        maxAttempts = maxAttempts,
        retryDelay = retryDelay,
    )

    private fun validOutput() =
        """
        {
          "questions": [{
            "sentenceKo": "다음 중 알맞은 것을 고르시오: 저는 사과( ) 먹어요.",
            "correctAnswer": "를",
            "distractors": ["은", "에", "이"],
            "explanationEn": "Use 를 because 사과 is the object of 먹어요."
          }]
        }
        """.trimIndent()

    private fun response(outputText: String) =
        """
        {
          "status": "completed",
          "output": [{
            "content": [{
              "type": "output_text",
              "text": ${objectMapper.writeValueAsString(outputText)}
            }]
          }]
        }
        """.trimIndent()
}

private const val RESPONSES_URL = "https://api.openai.com/v1/responses"

private val EXPECTED_QUIZ_FORMAT =
    """
    {
      "type": "json_schema",
      "name": "quiz_drafts",
      "strict": true,
      "schema": {
        "type": "object",
        "additionalProperties": false,
        "required": ["questions"],
        "properties": {
          "questions": {
            "type": "array",
            "minItems": 1,
            "maxItems": 1,
            "items": {
              "type": "object",
              "additionalProperties": false,
              "required": [
                "sentenceKo",
                "correctAnswer",
                "distractors",
                "explanationEn"
              ],
              "properties": {
                "sentenceKo": {"type": "string"},
                "correctAnswer": {"type": "string"},
                "distractors": {
                  "type": "array",
                  "minItems": 3,
                  "maxItems": 3,
                  "items": {"type": "string"}
                },
                "explanationEn": {"type": "string"}
              }
            }
          }
        }
      }
    }
    """.trimIndent()
