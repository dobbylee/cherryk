package io.github.dobbylee.cherryk.presentation.ocr

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import io.github.dobbylee.cherryk.application.ocr.MAX_OCR_IMAGE_BYTES
import io.github.dobbylee.cherryk.application.ocr.OcrImage
import io.github.dobbylee.cherryk.application.ocr.OcrProvider
import io.github.dobbylee.cherryk.application.ocr.OcrProviderException
import io.github.dobbylee.cherryk.application.ocr.OcrResult
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.boot.servlet.autoconfigure.MultipartProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.core.annotation.Order
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin
import org.springframework.security.web.SecurityFilterChain
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID
import javax.imageio.ImageIO
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(properties = ["cherryk.usage.daily-limits.ocr=1"])
@AutoConfigureMockMvc
@Import(OcrEndpointTestConfiguration::class)
class OcrEndpointIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val identityResolver: OidcIdentityResolver,
    @Autowired private val provider: ControllableOcrProvider,
) : PostgreSqlIntegrationTest() {
    @BeforeEach
    fun resetProvider() {
        provider.reset()
    }

    @Test
    fun `authenticated multipart request returns the frozen OCR contract`() {
        val subject = createUser()

        mockMvc
            .perform(ocrRequest(subject))
            .andExpect(status().isOk)
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.extractedText").value("저는 학교에서 공부했어요."))
            .andExpect(jsonPath("$.note").doesNotExist())

        assertEquals(1, provider.callCount)
    }

    @Test
    fun `authentication and CSRF are required before OCR processing`() {
        mockMvc
            .perform(multipart(OCR_PATH).file(validImage()).with(csrf()))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("unauthorized"))
            .andExpect(jsonPath("$.error.message").value("Authentication required."))

        mockMvc
            .perform(
                multipart(OCR_PATH)
                    .file(validImage())
                    .with(oidcUser("unresolved-subject")),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("forbidden"))

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `an authenticated principal without an application identity is unauthorized`() {
        mockMvc
            .perform(
                multipart(OCR_PATH)
                    .file(validImage())
                    .with(oidcUser("missing-${UUID.randomUUID()}"))
                    .with(csrf()),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("unauthorized"))
            .andExpect(jsonPath("$.error.message").value("Authentication required."))

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `missing malformed and oversized images preserve public errors`() {
        val subject = createUser()

        mockMvc
            .perform(
                multipart(OCR_PATH)
                    .with(oidcUser(subject))
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_image"))
            .andExpect(jsonPath("$.error.message").value("Image file is required."))

        mockMvc
            .perform(
                post(OCR_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{}")
                    .with(oidcUser(subject))
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_request"))
            .andExpect(jsonPath("$.error.message").value("Request body must be form data."))

        mockMvc
            .perform(
                multipart(OCR_PATH)
                    .file(
                        MockMultipartFile(
                            OCR_IMAGE_FIELD_NAME,
                            "large.jpg",
                            MediaType.IMAGE_JPEG_VALUE,
                            ByteArray(MAX_OCR_IMAGE_BYTES + 1),
                        ),
                    ).with(oidcUser(subject))
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_image"))
            .andExpect(jsonPath("$.error.message").value("Image must be 5 MB or smaller."))

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `daily limit rejects a second request before the provider call`() {
        val subject = createUser()

        mockMvc.perform(ocrRequest(subject)).andExpect(status().isOk)
        mockMvc
            .perform(ocrRequest(subject))
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error.code").value("daily_limit_reached"))
            .andExpect(
                jsonPath("$.error.message")
                    .value("Daily photo upload limit reached. Try again tomorrow."),
            )

        assertEquals(1, provider.callCount)
    }

    @Test
    fun `provider failure is hidden and releases the usage reservation`() {
        val subject = createUser()
        provider.failure =
            OcrProviderException(
                code = "timeout",
                message = "Secret provider detail.",
                retryable = true,
            )

        mockMvc
            .perform(ocrRequest(subject))
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.error.code").value("server_error"))
            .andExpect(jsonPath("$.error.message").value("OCR is unavailable."))

        provider.failure = null

        mockMvc.perform(ocrRequest(subject)).andExpect(status().isOk)
        assertEquals(2, provider.callCount)
    }

    private fun createUser(): String {
        val subject = "ocr-${UUID.randomUUID()}"
        identityResolver.resolveOrCreate(
            OidcIdentityProfile(
                issuer = GOOGLE_ISSUER,
                subject = subject,
                email = null,
                emailVerified = false,
                displayName = "OCR learner",
                image = null,
            ),
        )
        return subject
    }

    private fun ocrRequest(subject: String) =
        multipart(OCR_PATH)
            .file(validImage())
            .with(oidcUser(subject))
            .with(csrf())

    private fun validImage() =
        MockMultipartFile(
            OCR_IMAGE_FIELD_NAME,
            "writing.jpg",
            MediaType.IMAGE_JPEG_VALUE,
            createJpeg(),
        )

    private fun oidcUser(subject: String) =
        oidcLogin().idToken { token ->
            token
                .issuer(GOOGLE_ISSUER)
                .subject(subject)
                .claim("email", "learner@example.com")
                .claim("email_verified", true)
    }
}

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@Import(OcrMultipartLimitTestSecurityConfiguration::class)
class OcrMultipartLimitIntegrationTest(
    @LocalServerPort private val port: Int,
    @Autowired private val multipartProperties: MultipartProperties,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `real oversized multipart upload stays in memory and preserves the public error`() {
        assertTrue(multipartProperties.isResolveLazily)
        assertTrue(
            multipartProperties.fileSizeThreshold.toBytes() >=
                multipartProperties.maxRequestSize.toBytes(),
        )

        val boundary = "cherryk-${UUID.randomUUID()}"
        val prefix =
            (
                "--$boundary\r\n" +
                    "Content-Disposition: form-data; name=\"$OCR_IMAGE_FIELD_NAME\"; " +
                    "filename=\"large.jpg\"\r\n" +
                    "Content-Type: image/jpeg\r\n\r\n"
            ).toByteArray()
        val suffix = "\r\n--$boundary--\r\n".toByteArray()
        val request =
            HttpRequest
                .newBuilder(URI("http://localhost:$port$OCR_PATH"))
                .header("Content-Type", "multipart/form-data; boundary=$boundary")
                .POST(
                    HttpRequest.BodyPublishers.ofByteArrays(
                        listOf(
                            prefix,
                            ByteArray(MAX_OCR_IMAGE_BYTES + 1),
                            suffix,
                        ),
                    ),
                ).build()

        val response =
            HttpClient
                .newHttpClient()
                .send(request, HttpResponse.BodyHandlers.ofString())

        assertEquals(400, response.statusCode())
        assertEquals(
            """{"error":{"code":"invalid_image","message":"Image must be 5 MB or smaller."}}""",
            response.body(),
        )
    }
}

@TestConfiguration(proxyBeanMethods = false)
class OcrEndpointTestConfiguration {
    @Bean
    @Primary
    fun controllableOcrProvider() = ControllableOcrProvider()
}

@TestConfiguration(proxyBeanMethods = false)
class OcrMultipartLimitTestSecurityConfiguration {
    @Bean
    @Order(0)
    fun ocrMultipartLimitSecurityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .securityMatcher(OCR_PATH)
            .authorizeHttpRequests { requests -> requests.anyRequest().permitAll() }
            .csrf { csrf -> csrf.disable() }
        return http.build()
    }
}

class ControllableOcrProvider : OcrProvider {
    var result = OcrResult(extractedText = "저는 학교에서 공부했어요.")
    var failure: RuntimeException? = null
    var callCount = 0
        private set

    override fun extract(image: OcrImage): OcrResult {
        callCount += 1
        failure?.let { throw it }
        return result
    }

    fun reset() {
        result = OcrResult(extractedText = "저는 학교에서 공부했어요.")
        failure = null
        callCount = 0
    }
}

private fun createJpeg(): ByteArray {
    val output = ByteArrayOutputStream()
    check(ImageIO.write(BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB), "jpeg", output))
    return output.toByteArray()
}

private const val OCR_PATH = "/api/v1/ocr/extract"
