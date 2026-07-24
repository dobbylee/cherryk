package io.github.dobbylee.cherryk.infrastructure.config

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class UsageMeteringConfigurationTest {
    @Test
    fun `rejects negative limits and accepts zero as disabled`() {
        assertFailsWith<IllegalArgumentException> {
            UsageMeteringProperties(dailyLimits = mapOf("ocr" to -1))
        }
        assertEquals(
            mapOf("ocr" to 0L),
            UsageMeteringProperties(dailyLimits = mapOf("ocr" to 0)).dailyLimits,
        )
    }
}
