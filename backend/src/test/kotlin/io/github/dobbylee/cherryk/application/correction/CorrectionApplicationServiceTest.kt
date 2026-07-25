package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.application.usage.UsageFeature
import io.github.dobbylee.cherryk.application.usage.UsageQuota
import io.github.dobbylee.cherryk.application.usage.UsageReservation
import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class CorrectionApplicationServiceTest {
    @Test
    fun `reserves calls guards persists and commits in order`() {
        val events = mutableListOf<String>()
        val persistence = RecordingCorrectionPersistence(events)
        val service =
            service(
                events = events,
                persistence = persistence,
                providerOutput =
                    CorrectionResult(
                        correctedText = "저는 학교에 가요.",
                        explanationEn = "Use the destination particle.",
                        mistakes =
                            listOf(
                                CorrectionMistake(
                                    tag = GrammarTag.PARTICLE_LOCATION,
                                    originalPart = "학교를",
                                    correctedPart = "학교에",
                                    explanationEn = "Use 에 for a destination.",
                                    severity = MistakeSeverity.MINOR,
                                ),
                            ),
                    ),
            )

        val result = service.correct(userId = 7, request = correctionRequest())

        assertEquals(91, result.correctionId)
        assertEquals("저는 학교를 가요.", result.originalText)
        assertEquals("저는 학교에 가요.", result.correctedText)
        assertEquals(listOf(GrammarTag.PARTICLE_LOCATION), result.recommendedTags)
        assertEquals(listOf("reserve", "provider", "persist", "commit"), events)
        assertEquals(
            CorrectionPersistenceInput(
                userId = 7,
                inputType = CorrectionInputType.TEXT,
                originalText = "저는 학교를 가요.",
                output =
                    CorrectionResult(
                        correctedText = "저는 학교에 가요.",
                        explanationEn = "Use the destination particle.",
                        mistakes = result.mistakes,
                    ),
                now = TEST_NOW,
            ),
            persistence.lastInput,
        )
    }

    @Test
    fun `persists normalized output and only the user-edited OCR text`() {
        val persistence = RecordingCorrectionPersistence()
        val service =
            service(
                persistence = persistence,
                providerOutput =
                    CorrectionResult(
                        correctedText = " 제가  직접 고친 문장입니다. ",
                        explanationEn = "Only whitespace changed.",
                        mistakes =
                            listOf(
                                CorrectionMistake(
                                    tag = GrammarTag.SPACING,
                                    originalPart = "문장",
                                    correctedPart = "문장",
                                    explanationEn = "No real change.",
                                    severity = MistakeSeverity.MINOR,
                                ),
                            ),
                    ),
            )
        val editedText = "제가 직접 고친 문장입니다."

        val result =
            service.correct(
                userId = 8,
                request =
                    correctionRequest().copy(
                        text = editedText,
                        inputType = CorrectionInputType.IMAGE_OCR,
                    ),
            )

        assertEquals(editedText, result.originalText)
        assertEquals(editedText, result.correctedText)
        assertEquals("No corrections were needed.", result.explanationEn)
        assertEquals(emptyList(), result.mistakes)
        assertEquals(CorrectionInputType.IMAGE_OCR, persistence.lastInput?.inputType)
        assertEquals(editedText, persistence.lastInput?.originalText)
        assertEquals(editedText, persistence.lastInput?.output?.correctedText)
    }

    @Test
    fun `does not make a paid call or persist when usage reservation is rejected`() {
        var providerCalls = 0
        var persistenceCalls = 0
        val service =
            CorrectionApplicationService(
                usageQuota =
                    object : UsageQuota {
                        override fun reserve(
                            userId: Long,
                            feature: UsageFeature,
                            units: Long,
                        ): UsageReservation = throw UsageRejectedException()

                        override fun commit(reservation: UsageReservation) = Unit

                        override fun release(reservation: UsageReservation) = Unit
                    },
                provider =
                    CorrectionProvider {
                        providerCalls += 1
                        validCorrectionResult()
                    },
                outputGuard = CorrectionOutputGuard(),
                persistence =
                    object : CorrectionPersistence {
                        override fun persist(input: CorrectionPersistenceInput): PersistedCorrection {
                            persistenceCalls += 1
                            return PersistedCorrection(1, emptyList())
                        }
                    },
                clock = TEST_CLOCK,
            )

        assertFailsWith<UsageRejectedException> {
            service.correct(1, correctionRequest())
        }
        assertEquals(0, providerCalls)
        assertEquals(0, persistenceCalls)
    }

    @Test
    fun `releases usage and does not persist provider or guard failures`() {
        val providerFailure =
            CorrectionProviderException("timeout", "Correction timed out.")
        val providerEvents = mutableListOf<String>()
        val providerPersistence = RecordingCorrectionPersistence(providerEvents)
        val providerService =
            service(
                events = providerEvents,
                persistence = providerPersistence,
                providerFailure = providerFailure,
            )

        val actualProviderFailure =
            assertFailsWith<CorrectionProviderException> {
                providerService.correct(1, correctionRequest())
            }

        assertSame(providerFailure, actualProviderFailure)
        assertEquals(listOf("reserve", "provider", "release"), providerEvents)
        assertEquals(null, providerPersistence.lastInput)

        val guardEvents = mutableListOf<String>()
        val guardPersistence = RecordingCorrectionPersistence(guardEvents)
        val guardService =
            service(
                events = guardEvents,
                persistence = guardPersistence,
                providerOutput =
                    CorrectionResult(
                        correctedText = "I go to school.",
                        explanationEn = "Translated instead of corrected.",
                        mistakes = emptyList(),
                    ),
            )

        val guardFailure =
            assertFailsWith<CorrectionOutputException> {
                guardService.correct(1, correctionRequest())
            }

        assertEquals("invalid_ai_output", guardFailure.code)
        assertEquals(listOf("reserve", "provider", "release"), guardEvents)
        assertEquals(null, guardPersistence.lastInput)
    }

    @Test
    fun `releases usage and preserves persistence failures`() {
        val persistenceFailure = IllegalStateException("Database write failed.")
        val events = mutableListOf<String>()
        val service =
            service(
                events = events,
                persistence =
                    object : CorrectionPersistence {
                        override fun persist(input: CorrectionPersistenceInput): PersistedCorrection {
                            events += "persist"
                            throw persistenceFailure
                        }
                    },
            )

        val actual =
            assertFailsWith<IllegalStateException> {
                service.correct(1, correctionRequest())
            }

        assertSame(persistenceFailure, actual)
        assertEquals(listOf("reserve", "provider", "persist", "release"), events)
    }

    @Test
    fun `keeps the original failure when releasing usage also fails`() {
        val providerFailure = CorrectionProviderException("request_failed", "Provider failed.")
        val releaseFailure = IllegalStateException("Release failed.")
        val service =
            CorrectionApplicationService(
                usageQuota =
                    object : UsageQuota {
                        override fun reserve(
                            userId: Long,
                            feature: UsageFeature,
                            units: Long,
                        ) = UsageReservation(1, feature, units)

                        override fun commit(reservation: UsageReservation) = Unit

                        override fun release(reservation: UsageReservation) {
                            throw releaseFailure
                        }
                    },
                provider = CorrectionProvider { throw providerFailure },
                outputGuard = CorrectionOutputGuard(),
                persistence = RecordingCorrectionPersistence(),
                clock = TEST_CLOCK,
            )

        val actual =
            assertFailsWith<CorrectionProviderException> {
                service.correct(1, correctionRequest())
            }

        assertSame(providerFailure, actual)
        assertEquals(listOf(releaseFailure), actual.suppressedExceptions.toList())
    }
}

private class UsageRejectedException : RuntimeException()

private class RecordingCorrectionUsageQuota(
    private val events: MutableList<String>,
) : UsageQuota {
    override fun reserve(
        userId: Long,
        feature: UsageFeature,
        units: Long,
    ): UsageReservation {
        events += "reserve"
        assertEquals(UsageFeature.CORRECTION, feature)
        assertEquals(1, units)
        return UsageReservation(1, feature, units)
    }

    override fun commit(reservation: UsageReservation) {
        events += "commit"
    }

    override fun release(reservation: UsageReservation) {
        events += "release"
    }
}

private class RecordingCorrectionPersistence(
    private val events: MutableList<String> = mutableListOf(),
) : CorrectionPersistence {
    var lastInput: CorrectionPersistenceInput? = null
        private set

    override fun persist(input: CorrectionPersistenceInput): PersistedCorrection {
        events += "persist"
        lastInput = input
        return PersistedCorrection(
            correctionId = 91,
            recommendedTags = input.output.mistakes.map(CorrectionMistake::tag).distinct(),
        )
    }
}

private fun service(
    events: MutableList<String> = mutableListOf(),
    persistence: CorrectionPersistence = RecordingCorrectionPersistence(events),
    providerOutput: CorrectionResult = validCorrectionResult(),
    providerFailure: RuntimeException? = null,
) = CorrectionApplicationService(
    usageQuota = RecordingCorrectionUsageQuota(events),
    provider =
        CorrectionProvider {
            events += "provider"
            providerFailure?.let { throw it }
            providerOutput
        },
    outputGuard = CorrectionOutputGuard(),
    persistence = persistence,
    clock = TEST_CLOCK,
)

private fun correctionRequest() =
    CorrectionRequest(
        text = "저는 학교를 가요.",
        inputType = CorrectionInputType.TEXT,
        level = UserLevel.BEGINNER,
    )

private fun validCorrectionResult() =
    CorrectionResult(
        correctedText = "저는 학교에 가요.",
        explanationEn = "Use the destination particle.",
        mistakes = emptyList(),
    )

private val TEST_NOW = Instant.parse("2026-07-25T02:00:00Z")
private val TEST_CLOCK = Clock.fixed(TEST_NOW, ZoneOffset.UTC)
