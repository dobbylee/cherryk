package io.github.dobbylee.cherryk.infrastructure.provider.openai

import org.junit.jupiter.api.Test
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class OpenAiCorrectionConfigurationTest {
    @Test
    fun `validates retry timeout and reasoning settings`() {
        assertFailsWith<IllegalArgumentException> {
            properties(timeout = Duration.ZERO)
        }
        assertFailsWith<IllegalArgumentException> {
            properties(maxAttempts = 4)
        }
        assertFailsWith<IllegalArgumentException> {
            properties(retryDelay = Duration.ofMillis(-1))
        }
        assertFailsWith<IllegalArgumentException> {
            properties(reasoningEffort = "extreme")
        }
        assertEquals("low", properties(reasoningEffort = "low").reasoningEffort)
    }

    private fun properties(
        reasoningEffort: String = "",
        timeout: Duration = Duration.ofSeconds(10),
        maxAttempts: Int = 2,
        retryDelay: Duration = Duration.ofMillis(200),
    ) = OpenAiCorrectionProperties(
        apiKey = "test-key",
        model = "test-model",
        reasoningEffort = reasoningEffort,
        timeout = timeout,
        maxAttempts = maxAttempts,
        retryDelay = retryDelay,
    )
}
