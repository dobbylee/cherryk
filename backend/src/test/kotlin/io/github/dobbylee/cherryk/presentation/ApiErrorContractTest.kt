package io.github.dobbylee.cherryk.presentation

import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper
import kotlin.test.assertEquals

class ApiErrorContractTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `API error matches the shared TypeScript contract fixture`() {
        val fixture =
            ClassPathResource("api-v1.json").inputStream.use(objectMapper::readTree)
                .get("apiError")
        val actual: JsonNode =
            objectMapper.valueToTree(
                apiError(
                    code = "validation_failed",
                    message = "The request is invalid.",
                ),
            )

        assertEquals(fixture, actual)
    }
}
