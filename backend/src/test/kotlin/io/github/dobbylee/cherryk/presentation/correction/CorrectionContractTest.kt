package io.github.dobbylee.cherryk.presentation.correction

import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper
import kotlin.test.assertEquals

class CorrectionContractTest {
    private val objectMapper = jacksonObjectMapper()
    private val fixtures =
        ClassPathResource("api-v1.json").inputStream.use(objectMapper::readTree)

    @Test
    fun `correction request matches the shared TypeScript contract fixture`() {
        val actual: JsonNode =
            objectMapper.valueToTree(
                CorrectionCreateRequest(
                    text = "저는 학교에 공부했어요.",
                    inputType = "text",
                    level = "beginner",
                    correctionStyle = "minimal",
                ),
            )

        assertEquals(fixtures.get("correctionRequest"), actual)
    }

    @Test
    fun `correction response matches the shared TypeScript contract fixture`() {
        val actual: JsonNode =
            objectMapper.valueToTree(
                CorrectionResponse(
                    correctionId = "2001",
                    originalText = "저는 학교에 공부했어요.",
                    correctedText = "저는 학교에서 공부했어요.",
                    explanationEn = "Use 에서 for the place where an action happens.",
                    mistakes =
                        listOf(
                            CorrectionMistakeResponse(
                                tag = "particle_location",
                                originalPart = "학교에",
                                correctedPart = "학교에서",
                                explanationEn = "The action 공부했어요 happens at school.",
                                severity = "minor",
                            ),
                        ),
                    recommendedTags = listOf("particle_location"),
                ),
            )

        assertEquals(fixtures.get("correctionResponse"), actual)
    }
}
