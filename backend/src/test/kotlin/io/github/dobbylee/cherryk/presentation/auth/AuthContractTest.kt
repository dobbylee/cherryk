package io.github.dobbylee.cherryk.presentation.auth

import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.util.UUID
import kotlin.test.assertEquals

class AuthContractTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `me response matches the shared TypeScript contract fixture`() {
        val fixture =
            ClassPathResource("api-v1.json").inputStream.use(objectMapper::readTree)
                .get("meResponse")
        val actual: JsonNode =
            objectMapper.valueToTree(
                MeResponse(
                    user =
                        AuthUserResponse(
                            id = UUID.fromString("10000000-0000-4000-8000-000000000001"),
                            displayName = "Cherry",
                            level = "beginner",
                        ),
                ),
            )

        assertEquals(fixture, actual)
    }
}
