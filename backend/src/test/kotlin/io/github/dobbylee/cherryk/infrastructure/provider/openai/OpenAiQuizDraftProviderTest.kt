package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderException
import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderInput
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizType
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
                val providerInput = objectMapper.readTree(requestJson["input"].stringValue())
                assertEquals("grammar", providerInput["quizType"].stringValue())
                assertEquals("particle_object", providerInput["tag"].stringValue())
                assertEquals("beginner", providerInput["difficulty"].stringValue())
                assertEquals(1, providerInput["count"].asInt())
                assertEquals("Use food vocabulary.", providerInput["instruction"].stringValue())
                assertEquals(
                    objectMapper.readTree(EXPECTED_QUIZ_FORMAT),
                    requestJson["text"]["format"],
                )
                assertTrue(
                    requestJson["instructions"]
                        .stringValue()
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
    fun `creates vocabulary questions from English definitions and Korean choices`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andExpect { request ->
                val requestJson = objectMapper.readTree((request as MockClientHttpRequest).bodyAsString)
                val providerInput = objectMapper.readTree(requestJson["input"].stringValue())
                assertEquals("vocabulary", providerInput["quizType"].stringValue())
                assertEquals("word_choice", providerInput["tag"].stringValue())
                val questionSchema =
                    requestJson["text"]["format"]["schema"]["properties"]["questions"]["items"]
                assertTrue(questionSchema["properties"].has("questionEn"))
                assertTrue(!questionSchema["properties"].has("sentenceKo"))
            }
            .andRespond(
                withSuccess(
                    response(vocabularyOutput()),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val quiz =
            provider
                .generate(
                    input(
                        quizType = QuizType.VOCABULARY,
                        tag = GrammarTag.WORD_CHOICE,
                    ),
                ).single()

        assertEquals(QuizType.VOCABULARY, quiz.quizType)
        assertEquals("A place where people can borrow books.", quiz.questionEn)
        assertEquals(null, quiz.sentenceKo)
        assertEquals(setOf("도서관", "병원", "학교", "시장"), quiz.choices.map { it.text }.toSet())
        assertEquals("도서관", quiz.choices.single { it.correct }.text)
        server.verify()
    }

    @Test
    fun `rejects vocabulary output that leaks Korean in the definition or uses English choices`() {
        listOf(
            vocabularyOutput().replace(
                "A place where people can borrow books.",
                "도서관 means library.",
            ),
            vocabularyOutput().replace("도서관", "library"),
        ).forEach { output ->
            val builder = RestClient.builder()
            val localServer = MockRestServiceServer.bindTo(builder).build()
            localServer
                .expect(requestTo(RESPONSES_URL))
                .andRespond(withSuccess(response(output), MediaType.APPLICATION_JSON))
            val localProvider =
                OpenAiQuizDraftProvider(
                    restClient = builder.build(),
                    properties = properties(),
                    objectMapper = objectMapper,
                )

            assertFailsWith<QuizDraftProviderException> {
                localProvider.generate(
                    input(
                        quizType = QuizType.VOCABULARY,
                        tag = GrammarTag.WORD_CHOICE,
                    ),
                )
            }.also { exception ->
                assertEquals("invalid_response", exception.code)
            }
            localServer.verify()
        }
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
    fun `removes tag-specific Korean instructions from grammar exercise content`() {
        listOf(
            Triple(
                GrammarTag.PARTICLE_SUBJECT,
                "다음 빈칸에 알맞은 주격 조사를 넣으세요: 비( ) 와요.",
                "비( ) 와요.",
            ),
            Triple(
                GrammarTag.PARTICLE_TOPIC,
                "다음 문장에서 올바른 조사를 선택하세요: 저는 학생이에요.",
                "저는 학생이에요.",
            ),
            Triple(
                GrammarTag.PARTICLE_OBJECT,
                "다음 중에서 알맞은 것을 고르시오: 저는 사과( ) 먹어요.",
                "저는 사과( ) 먹어요.",
            ),
            Triple(
                GrammarTag.PARTICLE_OBJECT,
                "다음 중에 알맞은 것을 고르세요: 저는 책( ) 읽어요.",
                "저는 책( ) 읽어요.",
            ),
            Triple(
                GrammarTag.PARTICLE_LOCATION,
                "다음 문장에 맞는 위치 조사를 쓰세요: 학교( ) 공부해요.",
                "학교( ) 공부해요.",
            ),
            Triple(
                GrammarTag.VERB_CONJUGATION,
                "다음 동사를 올바르게 활용하세요: 어제 친구를 만났어요.",
                "어제 친구를 만났어요.",
            ),
            Triple(
                GrammarTag.HONORIFIC,
                "다음 문장을 높임말로 바꾸세요: 할머니께서 주무세요.",
                "할머니께서 주무세요.",
            ),
            Triple(
                GrammarTag.SPACING,
                "다음 문장의 띄어쓰기를 고치세요. 저는 학교에 가요.",
                "저는 학교에 가요.",
            ),
            Triple(
                GrammarTag.WORD_CHOICE,
                "다음 문장에 가장 자연스러운 단어를 쓰세요: 날씨가 아주 좋아요.",
                "날씨가 아주 좋아요.",
            ),
            Triple(
                GrammarTag.SENTENCE_ORDER,
                "다음 단어를 바르게 배열하세요: 저는 매일 학교에 가요.",
                "저는 매일 학교에 가요.",
            ),
            Triple(
                GrammarTag.MISSING_WORD,
                "다음 빈칸을 알맞은 단어로 채우세요: 저는 학교에 가요.",
                "저는 학교에 가요.",
            ),
        ).forEach { (tag, generatedSentence, expectedSentence) ->
            val builder = RestClient.builder()
            val localServer = MockRestServiceServer.bindTo(builder).build()
            localServer
                .expect(requestTo(RESPONSES_URL))
                .andRespond(
                    withSuccess(
                        response(validOutput().replace(GRAMMAR_SENTENCE, generatedSentence)),
                        MediaType.APPLICATION_JSON,
                    ),
                )
            val localProvider =
                OpenAiQuizDraftProvider(
                    restClient = builder.build(),
                    properties = properties(),
                    objectMapper = objectMapper,
                    randomIndex = { 0 },
                )

            val quiz = localProvider.generate(input(tag = tag)).single()

            assertEquals(expectedSentence, quiz.sentenceKo)
            localServer.verify()
        }
    }

    @Test
    fun `preserves a Korean instruction for unnatural quizzes`() {
        val generatedSentence = "다음 중 자연스러운 문장을 고르세요."
        server
            .expect(requestTo(RESPONSES_URL))
            .andRespond(
                withSuccess(
                    response(validOutput().replace(GRAMMAR_SENTENCE, generatedSentence)),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val quiz = provider.generate(input(tag = GrammarTag.UNNATURAL)).single()

        assertEquals(generatedSentence, quiz.sentenceKo)
        server.verify()
    }

    @Test
    fun `does not remove meaningful exercise content that starts with next`() {
        listOf(
            GrammarTag.PARTICLE_LOCATION to
                "다음 역에서 내리세요. 저는 서울역에서 내려요.",
            GrammarTag.PARTICLE_OBJECT to
                "다음 중간고사에서는 꼭 만점을 받으세요. 시험을 준비해요.",
            GrammarTag.VERB_CONJUGATION to
                "다음 동사무소에서 신청하세요. 서류를 준비했어요.",
        ).forEach { (tag, generatedSentence) ->
            val builder = RestClient.builder()
            val localServer = MockRestServiceServer.bindTo(builder).build()
            localServer
                .expect(requestTo(RESPONSES_URL))
                .andRespond(
                    withSuccess(
                        response(validOutput().replace(GRAMMAR_SENTENCE, generatedSentence)),
                        MediaType.APPLICATION_JSON,
                    ),
                )
            val localProvider =
                OpenAiQuizDraftProvider(
                    restClient = builder.build(),
                    properties = properties(),
                    objectMapper = objectMapper,
                    randomIndex = { 0 },
                )

            val quiz = localProvider.generate(input(tag = tag)).single()

            assertEquals(generatedSentence, quiz.sentenceKo)
            localServer.verify()
        }
    }

    @Test
    fun `rejects a grammar response that contains only a Korean instruction`() {
        server
            .expect(requestTo(RESPONSES_URL))
            .andRespond(
                withSuccess(
                    response(
                        validOutput().replace(
                            GRAMMAR_SENTENCE,
                            "다음 단어를 바르게 배열하세요:",
                        ),
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        assertFailsWith<QuizDraftProviderException> {
            provider.generate(input(tag = GrammarTag.SENTENCE_ORDER))
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
        quizType: QuizType = QuizType.GRAMMAR,
        tag: GrammarTag = GrammarTag.PARTICLE_OBJECT,
    ) = QuizDraftProviderInput(
        tag = tag,
        difficulty = UserLevel.BEGINNER,
        count = count,
        instruction = instruction,
        quizType = quizType,
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
            "sentenceKo": "$GRAMMAR_SENTENCE",
            "correctAnswer": "를",
            "distractors": ["은", "에", "이"],
            "explanationEn": "Use 를 because 사과 is the object of 먹어요."
          }]
        }
        """.trimIndent()

    private fun vocabularyOutput() =
        """
        {
          "questions": [{
            "questionEn": "A place where people can borrow books.",
            "correctAnswer": "도서관",
            "distractors": ["병원", "학교", "시장"],
            "explanationEn": "The Korean word 도서관 means library."
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
private const val GRAMMAR_SENTENCE = "다음 중 알맞은 것을 고르시오: 저는 사과( ) 먹어요."

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
