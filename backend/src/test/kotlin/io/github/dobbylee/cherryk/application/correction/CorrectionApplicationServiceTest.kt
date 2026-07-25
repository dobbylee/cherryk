package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.application.usage.UsageFeature
import io.github.dobbylee.cherryk.application.usage.UsageQuota
import io.github.dobbylee.cherryk.application.usage.UsageReservation
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

class CorrectionApplicationServiceTest {
    @Test
    fun `reserves usage before the provider and commits guarded output`() {
        val events = mutableListOf<String>()
        val service =
            CorrectionApplicationService(
                usageQuota = RecordingCorrectionUsageQuota(events),
                provider =
                    CorrectionProvider {
                        events += "provider"
                        CorrectionResult(
                            correctedText = " 저는  학교를 가요. ",
                            explanationEn = "Only whitespace changed.",
                            mistakes =
                                listOf(
                                    CorrectionMistake(
                                        tag = GrammarTag.SPACING,
                                        originalPart = "학교를",
                                        correctedPart = "학교를",
                                        explanationEn = "No real change.",
                                        severity = MistakeSeverity.MINOR,
                                    ),
                                ),
                        )
                    },
                outputGuard = CorrectionOutputGuard(),
            )

        val result =
            service.correct(
                userId = 7,
                request =
                    CorrectionRequest(
                        text = "저는 학교를 가요.",
                        level = UserLevel.BEGINNER,
                    ),
            )

        assertEquals("저는 학교를 가요.", result.correctedText)
        assertEquals("No corrections were needed.", result.explanationEn)
        assertEquals(emptyList(), result.mistakes)
        assertEquals(listOf("reserve", "provider", "commit"), events)
    }

    @Test
    fun `does not make a paid call when usage reservation is rejected`() {
        var providerCalls = 0
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
                        correctionResult()
                    },
                outputGuard = CorrectionOutputGuard(),
            )

        assertFailsWith<UsageRejectedException> {
            service.correct(1, correctionRequest())
        }
        assertEquals(0, providerCalls)
    }

    @Test
    fun `releases usage and preserves provider or guard failures`() {
        val providerFailure =
            CorrectionProviderException("timeout", "Correction timed out.")
        val providerEvents = mutableListOf<String>()
        val providerService =
            CorrectionApplicationService(
                usageQuota = RecordingCorrectionUsageQuota(providerEvents),
                provider = CorrectionProvider { throw providerFailure },
                outputGuard = CorrectionOutputGuard(),
            )

        val actualProviderFailure =
            assertFailsWith<CorrectionProviderException> {
                providerService.correct(1, correctionRequest())
            }

        assertSame(providerFailure, actualProviderFailure)
        assertEquals(listOf("reserve", "release"), providerEvents)

        val guardEvents = mutableListOf<String>()
        val guardService =
            CorrectionApplicationService(
                usageQuota = RecordingCorrectionUsageQuota(guardEvents),
                provider = CorrectionProvider { correctionResult() },
                outputGuard = CorrectionOutputGuard(),
            )

        val guardFailure =
            assertFailsWith<CorrectionOutputException> {
                guardService.correct(
                    1,
                    correctionRequest().copy(text = "저는 학교에 가요."),
                )
            }

        assertEquals("invalid_ai_output", guardFailure.code)
        assertEquals(listOf("reserve", "release"), guardEvents)
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

private fun correctionRequest() =
    CorrectionRequest(
        text = "저는 학교를 가요.",
        level = UserLevel.BEGINNER,
    )

private fun correctionResult() =
    CorrectionResult(
        correctedText = "I go to school.",
        explanationEn = "This is invalid for Korean correction.",
        mistakes = emptyList(),
    )
