package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.correction.CorrectionProvider
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import tools.jackson.databind.ObjectMapper
import java.net.http.HttpClient
import java.time.Duration

@ConfigurationProperties("cherryk.correction.openai")
data class OpenAiCorrectionProperties(
    val apiKey: String = "",
    val model: String = "",
    val reasoningEffort: String = "",
    val timeout: Duration = Duration.ofSeconds(10),
    val maxAttempts: Int = 2,
    val retryDelay: Duration = Duration.ofMillis(200),
) {
    init {
        require(reasoningEffort.isBlank() || reasoningEffort in REASONING_EFFORTS) {
            "OpenAI reasoning effort is not supported."
        }
        require(!timeout.isZero && !timeout.isNegative) {
            "OpenAI correction timeout must be positive."
        }
        require(maxAttempts in 1..3) {
            "OpenAI correction max attempts must be between 1 and 3."
        }
        require(!retryDelay.isNegative) {
            "OpenAI correction retry delay must not be negative."
        }
    }
}

@Configuration
@EnableConfigurationProperties(OpenAiCorrectionProperties::class)
class OpenAiCorrectionConfiguration {
    @Bean
    @Qualifier("openAiCorrectionRestClient")
    fun openAiCorrectionRestClient(
        builder: RestClient.Builder,
        properties: OpenAiCorrectionProperties,
    ): RestClient {
        val httpClient =
            HttpClient
                .newBuilder()
                .connectTimeout(properties.timeout)
                .build()
        val requestFactory =
            JdkClientHttpRequestFactory(httpClient).apply {
                setReadTimeout(properties.timeout)
            }
        return builder.requestFactory(requestFactory).build()
    }

    @Bean
    fun correctionProvider(
        @Qualifier("openAiCorrectionRestClient")
        restClient: RestClient,
        properties: OpenAiCorrectionProperties,
        objectMapper: ObjectMapper,
    ): CorrectionProvider = OpenAiCorrectionProvider(restClient, properties, objectMapper)
}

private val REASONING_EFFORTS = setOf("none", "low", "medium", "high", "xhigh", "max")
