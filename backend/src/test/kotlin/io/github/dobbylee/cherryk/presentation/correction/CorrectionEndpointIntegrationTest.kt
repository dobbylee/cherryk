package io.github.dobbylee.cherryk.presentation.correction

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import io.github.dobbylee.cherryk.application.correction.CorrectionMistake
import io.github.dobbylee.cherryk.application.correction.CorrectionProvider
import io.github.dobbylee.cherryk.application.correction.CorrectionProviderException
import io.github.dobbylee.cherryk.application.correction.CorrectionProviderInput
import io.github.dobbylee.cherryk.application.correction.CorrectionResult
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(properties = ["cherryk.usage.daily-limits.correction=1"])
@AutoConfigureMockMvc
@Import(CorrectionEndpointTestConfiguration::class)
class CorrectionEndpointIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val identityResolver: OidcIdentityResolver,
    @Autowired private val provider: ControllableCorrectionProvider,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    private val objectMapper = jacksonObjectMapper()

    @BeforeEach
    fun resetProvider() {
        provider.reset()
    }

    @Test
    fun `authenticated JSON request returns the public contract and persists edited OCR text`() {
        val subject = createUser()

        val response =
            mockMvc
                .perform(
                    correctionRequest(
                        subject = subject,
                        inputType = "image_ocr",
                        text = "  $ORIGINAL_TEXT  ",
                    ),
                )
                .andExpect(status().isOk)
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.correctionId").isString)
                .andExpect(jsonPath("$.originalText").value(ORIGINAL_TEXT))
                .andExpect(jsonPath("$.correctedText").value(CORRECTED_TEXT))
                .andExpect(
                    jsonPath("$.explanationEn")
                        .value("Use 에서 for the place where an action happens."),
                ).andExpect(jsonPath("$.mistakes[0].tag").value("particle_location"))
                .andExpect(jsonPath("$.mistakes[0].severity").value("minor"))
                .andExpect(jsonPath("$.recommendedTags[0]").value("particle_location"))
                .andReturn()
                .response
        val correctionId =
            objectMapper.readTree(response.contentAsString).get("correctionId").stringValue()

        assertTrue(correctionId.all(Char::isDigit))
        assertEquals(
            StoredCorrection(
                inputType = "image_ocr",
                originalText = ORIGINAL_TEXT,
                correctedText = CORRECTED_TEXT,
            ),
            jdbcClient
                .sql(
                    """
                    SELECT input_type, original_text, corrected_text
                    FROM corrections
                    WHERE id = :id
                    """.trimIndent(),
                ).param("id", correctionId.toLong())
                .query { resultSet, _ ->
                    StoredCorrection(
                        inputType = resultSet.getString("input_type"),
                        originalText = resultSet.getString("original_text"),
                        correctedText = resultSet.getString("corrected_text"),
                    )
                }.single(),
        )
        assertEquals(1, provider.callCount)
    }

    @Test
    fun `authentication and CSRF are required before correction processing`() {
        mockMvc
            .perform(
                post(CORRECTION_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validRequest())
                    .with(csrf()),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("unauthorized"))
            .andExpect(jsonPath("$.error.message").value("Authentication required."))

        mockMvc
            .perform(
                post(CORRECTION_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validRequest())
                    .with(oidcUser("unresolved-subject")),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("forbidden"))

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `an authenticated principal without an application identity is unauthorized`() {
        mockMvc
            .perform(
                post(CORRECTION_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validRequest())
                    .with(oidcUser("missing-${UUID.randomUUID()}"))
                    .with(csrf()),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("unauthorized"))
            .andExpect(jsonPath("$.error.message").value("Authentication required."))

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `malformed and invalid JSON requests preserve public errors`() {
        val subject = createUser()

        mockMvc
            .perform(
                post(CORRECTION_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{")
                    .with(oidcUser(subject))
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_request"))
            .andExpect(jsonPath("$.error.message").value("Request body must be JSON."))

        mockMvc
            .perform(
                post(CORRECTION_PATH)
                    .contentType(MediaType.TEXT_PLAIN)
                    .content(validRequest())
                    .with(oidcUser(subject))
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_request"))
            .andExpect(jsonPath("$.error.message").value("Request body must be JSON."))

        for (
            invalidRequest in
                listOf(
                    """{"text":"   ","inputType":"text","level":"beginner","correctionStyle":"minimal"}""",
                    """{"text":42,"inputType":"text","level":"beginner","correctionStyle":"minimal"}""",
                    """{"text":"${"가".repeat(4001)}","inputType":"text","level":"beginner","correctionStyle":"minimal"}""",
                    """{"text":"문장","inputType":"camera","level":"beginner","correctionStyle":"minimal"}""",
                    """{"text":"문장","inputType":"text","level":"advanced","correctionStyle":"minimal"}""",
                    """{"text":"문장","inputType":"text","level":"beginner","correctionStyle":"natural"}""",
                    "[]",
                )
        ) {
            mockMvc
                .perform(
                    post(CORRECTION_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidRequest)
                        .with(oidcUser(subject))
                        .with(csrf()),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error.code").value("invalid_request"))
                .andExpect(jsonPath("$.error.message").value("Correction request is invalid."))
        }

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `daily limit rejects a second request before the provider call`() {
        val subject = createUser()

        mockMvc.perform(correctionRequest(subject)).andExpect(status().isOk)
        mockMvc
            .perform(correctionRequest(subject))
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error.code").value("daily_limit_reached"))
            .andExpect(
                jsonPath("$.error.message")
                    .value("Daily correction limit reached. Try again tomorrow."),
            )

        assertEquals(1, provider.callCount)
    }

    @Test
    fun `provider failure is hidden and releases the usage reservation`() {
        val subject = createUser()
        provider.failure =
            CorrectionProviderException(
                code = "timeout",
                message = "Secret provider detail.",
                retryable = true,
            )

        mockMvc
            .perform(correctionRequest(subject))
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.error.code").value("server_error"))
            .andExpect(jsonPath("$.error.message").value("Correction is unavailable."))

        provider.failure = null

        mockMvc.perform(correctionRequest(subject)).andExpect(status().isOk)
        assertEquals(2, provider.callCount)
    }

    @Test
    fun `invalid semantic output returns a stable gateway error and releases usage`() {
        val subject = createUser()
        provider.result =
            CorrectionResult(
                correctedText = "I study at school.",
                explanationEn = "Translated instead of corrected.",
                mistakes = emptyList(),
            )

        mockMvc
            .perform(correctionRequest(subject))
            .andExpect(status().isBadGateway)
            .andExpect(jsonPath("$.error.code").value("invalid_ai_output"))
            .andExpect(jsonPath("$.error.message").value("AI correction output is invalid."))

        provider.result = validResult()

        mockMvc.perform(correctionRequest(subject)).andExpect(status().isOk)
        assertEquals(2, provider.callCount)
    }

    private fun createUser(): String {
        val subject = "correction-${UUID.randomUUID()}"
        identityResolver.resolveOrCreate(
            OidcIdentityProfile(
                issuer = GOOGLE_ISSUER,
                subject = subject,
                email = null,
                emailVerified = false,
                displayName = "Correction learner",
                image = null,
            ),
        )
        return subject
    }

    private fun correctionRequest(
        subject: String,
        inputType: String = "text",
        text: String = ORIGINAL_TEXT,
    ) = post(CORRECTION_PATH)
        .contentType(MediaType.APPLICATION_JSON)
        .content(validRequest(inputType, text))
        .with(oidcUser(subject))
        .with(csrf())

    private fun validRequest(
        inputType: String = "text",
        text: String = ORIGINAL_TEXT,
    ) =
        """
        {
          "text": "$text",
          "inputType": "$inputType",
          "level": "beginner",
          "correctionStyle": "minimal"
        }
        """.trimIndent()

    private fun oidcUser(subject: String) =
        oidcLogin().idToken { token ->
            token
                .issuer(GOOGLE_ISSUER)
                .subject(subject)
                .claim("email", "learner@example.com")
                .claim("email_verified", true)
        }
}

@TestConfiguration(proxyBeanMethods = false)
class CorrectionEndpointTestConfiguration {
    @Bean
    @Primary
    fun controllableCorrectionProvider() = ControllableCorrectionProvider()
}

class ControllableCorrectionProvider : CorrectionProvider {
    var result = validResult()
    var failure: RuntimeException? = null
    var callCount = 0
        private set

    override fun correct(input: CorrectionProviderInput): CorrectionResult {
        callCount += 1
        failure?.let { throw it }
        return result
    }

    fun reset() {
        result = validResult()
        failure = null
        callCount = 0
    }
}

private data class StoredCorrection(
    val inputType: String,
    val originalText: String,
    val correctedText: String,
)

private fun validResult() =
    CorrectionResult(
        correctedText = CORRECTED_TEXT,
        explanationEn = "Use 에서 for the place where an action happens.",
        mistakes =
            listOf(
                CorrectionMistake(
                    tag = GrammarTag.PARTICLE_LOCATION,
                    originalPart = "학교에",
                    correctedPart = "학교에서",
                    explanationEn = "The action 공부했어요 happens at school.",
                    severity = MistakeSeverity.MINOR,
                ),
            ),
    )

private const val CORRECTION_PATH = "/api/v1/corrections"
private const val ORIGINAL_TEXT = "저는 학교에 공부했어요."
private const val CORRECTED_TEXT = "저는 학교에서 공부했어요."
