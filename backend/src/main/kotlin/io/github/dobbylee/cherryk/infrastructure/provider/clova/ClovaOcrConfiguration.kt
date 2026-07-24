package io.github.dobbylee.cherryk.infrastructure.provider.clova

import io.github.dobbylee.cherryk.application.ocr.OcrProvider
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.client.JdkClientHttpRequestFactory
import org.springframework.web.client.RestClient
import java.net.http.HttpClient
import java.time.Clock
import java.time.Duration

@ConfigurationProperties("cherryk.ocr.clova")
data class ClovaOcrProperties(
    val invokeUrl: String = "",
    val secret: String = "",
    val timeout: Duration = Duration.ofSeconds(10),
    val maxAttempts: Int = 2,
    val retryDelay: Duration = Duration.ofMillis(200),
) {
    init {
        require(!timeout.isZero && !timeout.isNegative) {
            "CLOVA OCR timeout must be positive."
        }
        require(maxAttempts in 1..3) {
            "CLOVA OCR max attempts must be between 1 and 3."
        }
        require(!retryDelay.isNegative) {
            "CLOVA OCR retry delay must not be negative."
        }
    }
}

@Configuration
@EnableConfigurationProperties(ClovaOcrProperties::class)
class ClovaOcrConfiguration {
    @Bean
    @Qualifier("clovaOcrRestClient")
    fun clovaOcrRestClient(
        builder: RestClient.Builder,
        properties: ClovaOcrProperties,
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
    fun ocrProvider(
        @Qualifier("clovaOcrRestClient")
        restClient: RestClient,
        properties: ClovaOcrProperties,
        clock: Clock,
    ): OcrProvider = ClovaOcrProvider(restClient, properties, clock)
}
