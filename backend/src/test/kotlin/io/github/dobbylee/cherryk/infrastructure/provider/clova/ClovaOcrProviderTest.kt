package io.github.dobbylee.cherryk.infrastructure.provider.clova

import io.github.dobbylee.cherryk.application.ocr.OcrImage
import io.github.dobbylee.cherryk.application.ocr.OcrImageFormat
import io.github.dobbylee.cherryk.application.ocr.OcrProviderException
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.header
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.ResourceAccessException
import org.springframework.web.client.RestClient
import java.net.SocketTimeoutException
import java.time.Clock
import java.time.Duration
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class ClovaOcrProviderTest {
    private val requestId = UUID.fromString("10000000-0000-4000-8000-000000000001")
    private val clock = Clock.fixed(Instant.parse("2026-07-25T00:00:00Z"), ZoneOffset.UTC)
    private val retryWaits = mutableListOf<Duration>()
    private lateinit var server: MockRestServiceServer
    private lateinit var provider: ClovaOcrProvider

    @BeforeEach
    fun setUp() {
        val builder = RestClient.builder()
        server = MockRestServiceServer.bindTo(builder).build()
        provider =
            ClovaOcrProvider(
                restClient = builder.build(),
                properties = properties(),
                clock = clock,
                requestIdFactory = { requestId },
                retryWaiter = retryWaits::add,
            )
    }

    @Test
    fun `sends the General OCR V2 contract and preserves line breaks`() {
        server
            .expect(requestTo(INVOKE_URL))
            .andExpect(method(HttpMethod.POST))
            .andExpect(header("X-OCR-SECRET", "test-secret"))
            .andExpect(
                content().json(
                    """
                    {
                      "version": "V2",
                      "requestId": "$requestId",
                      "timestamp": 1784937600000,
                      "lang": "ko",
                      "images": [{
                        "format": "png",
                        "name": "cherryk-ocr",
                        "data": "aW1hZ2U="
                      }],
                      "enableTableDetection": false
                    }
                    """.trimIndent(),
                ),
            ).andRespond(
                withSuccess(
                    successResponse(
                        """
                        {"inferText":"저는","lineBreak":false},
                        {"inferText":"학교에","lineBreak":true},
                        {"inferText":"공부했어요.","lineBreak":false}
                        """.trimIndent(),
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result =
            provider.extract(
                OcrImage(
                    bytes = "image".toByteArray(),
                    format = OcrImageFormat.PNG,
                ),
            )

        assertEquals("저는 학교에\n공부했어요.", result.extractedText)
        assertEquals(null, result.note)
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `retries a transient response once with the same logical request`() {
        server
            .expect(requestTo(INVOKE_URL))
            .andExpect(content().string(org.hamcrest.Matchers.containsString(requestId.toString())))
            .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))
        server
            .expect(requestTo(INVOKE_URL))
            .andExpect(content().string(org.hamcrest.Matchers.containsString(requestId.toString())))
            .andRespond(
                withSuccess(
                    successResponse("""{"inferText":"안녕하세요","lineBreak":false}"""),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val result =
            provider.extract(
                OcrImage("image".toByteArray(), OcrImageFormat.JPEG),
            )

        assertEquals("안녕하세요", result.extractedText)
        assertEquals(listOf(Duration.ofMillis(200)), retryWaits)
        server.verify()
    }

    @Test
    fun `does not retry a non-transient client response`() {
        server
            .expect(requestTo(INVOKE_URL))
            .andRespond(withStatus(HttpStatus.BAD_REQUEST))

        val exception =
            assertFailsWith<OcrProviderException> {
                provider.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
            }

        assertEquals("request_failed", exception.code)
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `bounds timeout retries and returns a stable timeout error`() {
        repeat(2) {
            server
                .expect(requestTo(INVOKE_URL))
                .andRespond {
                    throw ResourceAccessException(
                        "Do not expose this transport message.",
                        SocketTimeoutException(),
                    )
                }
        }

        val exception =
            assertFailsWith<OcrProviderException> {
                provider.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
            }

        assertEquals("timeout", exception.code)
        assertEquals("CLOVA OCR request timed out.", exception.message)
        assertEquals(listOf(Duration.ofMillis(200)), retryWaits)
        server.verify()
    }

    @Test
    fun `rejects a response that does not match the request id`() {
        server
            .expect(requestTo(INVOKE_URL))
            .andRespond(
                withSuccess(
                    successResponse(
                        fields = """{"inferText":"안녕하세요","lineBreak":false}""",
                        responseRequestId = "different-request",
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        val exception =
            assertFailsWith<OcrProviderException> {
                provider.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
            }

        assertEquals("invalid_response", exception.code)
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `rejects empty successful responses with a stable error`() {
        server
            .expect(requestTo(INVOKE_URL))
            .andRespond(
                withSuccess(successResponse(fields = ""), MediaType.APPLICATION_JSON),
            )
        server
            .expect(requestTo(INVOKE_URL))
            .andRespond(
                withSuccess(
                    successResponse(
                        fields = """{"inferText":"   ","lineBreak":true}""",
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        repeat(2) {
            val exception =
                assertFailsWith<OcrProviderException> {
                    provider.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
                }
            assertEquals("empty_result", exception.code)
        }
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `requires the V2 response version`() {
        server
            .expect(requestTo(INVOKE_URL))
            .andRespond(
                withSuccess(
                    successResponse(
                        fields = """{"inferText":"안녕하세요","lineBreak":false}""",
                        responseVersion = "V1",
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )
        server
            .expect(requestTo(INVOKE_URL))
            .andRespond(
                withSuccess(
                    successResponse(
                        fields = """{"inferText":"안녕하세요","lineBreak":false}""",
                        responseVersion = null,
                    ),
                    MediaType.APPLICATION_JSON,
                ),
            )

        repeat(2) {
            val exception =
                assertFailsWith<OcrProviderException> {
                    provider.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
                }
            assertEquals("invalid_response", exception.code)
        }
        assertEquals(emptyList(), retryWaits)
        server.verify()
    }

    @Test
    fun `fails before HTTP when required configuration is missing`() {
        val unconfigured =
            ClovaOcrProvider(
                restClient = RestClient.create(),
                properties = properties().copy(secret = ""),
                clock = clock,
            )

        val exception =
            assertFailsWith<OcrProviderException> {
                unconfigured.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
            }

        assertEquals("not_configured", exception.code)
    }

    @Test
    fun `rejects insecure and malformed invoke URLs before HTTP`() {
        for (invokeUrl in listOf("http://clova.example.test/general", "not a URI")) {
            val invalid =
                ClovaOcrProvider(
                    restClient = RestClient.create(),
                    properties = properties().copy(invokeUrl = invokeUrl),
                    clock = clock,
                )

            val exception =
                assertFailsWith<OcrProviderException> {
                    invalid.extract(OcrImage("image".toByteArray(), OcrImageFormat.JPEG))
                }
            assertEquals("not_configured", exception.code)
        }
    }

    private fun properties() =
        ClovaOcrProperties(
            invokeUrl = INVOKE_URL,
            secret = "test-secret",
            timeout = Duration.ofSeconds(10),
            maxAttempts = 2,
            retryDelay = Duration.ofMillis(200),
        )

    private fun successResponse(
        fields: String,
        responseRequestId: String = requestId.toString(),
        responseVersion: String? = "V2",
    ) = """
        {
          ${responseVersion?.let { """"version": "$it",""" }.orEmpty()}
          "requestId": "$responseRequestId",
          "timestamp": 1784937600000,
          "images": [{
            "uid": "image-uid",
            "name": "cherryk-ocr",
            "inferResult": "SUCCESS",
            "message": "SUCCESS",
            "fields": [$fields]
          }]
        }
        """.trimIndent()

    private companion object {
        const val INVOKE_URL = "https://clova.example.test/general"
    }
}
