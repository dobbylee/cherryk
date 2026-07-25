package io.github.dobbylee.cherryk.infrastructure.provider.openai

import io.github.dobbylee.cherryk.application.quiz.QuizDraftProvider
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

@ConfigurationProperties("cherryk.quiz.openai")
data class OpenAiQuizDraftProperties(
    val apiKey: String = "",
    val model: String = "",
    val reasoningEffort: String = "",
    val timeout: Duration = Duration.ofSeconds(15),
    val maxAttempts: Int = 2,
    val retryDelay: Duration = Duration.ofMillis(200),
) {
    init {
        require(reasoningEffort.isBlank() || reasoningEffort in QUIZ_REASONING_EFFORTS) {
            "OpenAI quiz reasoning effort is not supported."
        }
        require(!timeout.isZero && !timeout.isNegative) {
            "OpenAI quiz timeout must be positive."
        }
        require(maxAttempts in 1..3) {
            "OpenAI quiz max attempts must be between 1 and 3."
        }
        require(!retryDelay.isNegative) {
            "OpenAI quiz retry delay must not be negative."
        }
    }
}

@Configuration
@EnableConfigurationProperties(OpenAiQuizDraftProperties::class)
class OpenAiQuizDraftConfiguration {
    @Bean
    @Qualifier("openAiQuizDraftRestClient")
    fun openAiQuizDraftRestClient(
        builder: RestClient.Builder,
        properties: OpenAiQuizDraftProperties,
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
    fun quizDraftProvider(
        @Qualifier("openAiQuizDraftRestClient")
        restClient: RestClient,
        properties: OpenAiQuizDraftProperties,
        objectMapper: ObjectMapper,
    ): QuizDraftProvider = OpenAiQuizDraftProvider(restClient, properties, objectMapper)
}

private val QUIZ_REASONING_EFFORTS = setOf("none", "low", "medium", "high", "xhigh", "max")
