package io.github.dobbylee.cherryk.presentation.ocr

import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper
import kotlin.test.assertEquals
import kotlin.test.assertFalse

class OcrContractTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `OCR response matches the shared TypeScript contract fixture`() {
        val fixture =
            ClassPathResource("api-v1.json").inputStream.use(objectMapper::readTree)
                .get("ocrResponse")
        val actual: JsonNode =
            objectMapper.valueToTree(
                OcrExtractResponse(
                    extractedText = "저는 학교에 공부했어요.",
                    note = "Please review the extracted spacing.",
                ),
            )

        assertEquals(fixture, actual)
    }

    @Test
    fun `OCR response omits an absent optional note`() {
        val actual = objectMapper.valueToTree<JsonNode>(OcrExtractResponse("안녕하세요."))

        assertFalse(actual.has("note"))
    }
}
