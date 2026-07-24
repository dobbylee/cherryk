package io.github.dobbylee.cherryk.domain.quiz

import org.junit.jupiter.api.Test
import tools.jackson.module.kotlin.jacksonObjectMapper
import tools.jackson.module.kotlin.readValue
import kotlin.test.assertEquals

class QuizContentFingerprintTest {
    private val objectMapper = jacksonObjectMapper()

    @Test
    fun `matches the shared TypeScript golden fixtures`() {
        val resource =
            requireNotNull(javaClass.classLoader.getResource("quiz-fingerprint.json")) {
                "Shared quiz fingerprint fixture is missing."
            }
        val fixture =
            resource.openStream().use { input ->
                objectMapper.readValue<QuizFingerprintFixture>(input)
            }

        assertEquals(1, fixture.version)
        fixture.cases.forEach { testCase ->
            assertEquals(
                testCase.expected,
                QuizContentFingerprint.create(testCase.input),
                testCase.name,
            )
        }
    }
}

private data class QuizFingerprintFixture(
    val version: Int,
    val cases: List<QuizFingerprintCase>,
)

private data class QuizFingerprintCase(
    val name: String,
    val source: String? = null,
    val recordId: String? = null,
    val input: QuizFingerprintInput,
    val expected: String,
)
