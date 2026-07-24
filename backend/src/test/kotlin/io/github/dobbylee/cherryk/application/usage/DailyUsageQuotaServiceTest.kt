package io.github.dobbylee.cherryk.application.usage

import org.junit.jupiter.api.Test
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class DailyUsageQuotaServiceTest {
    private val clock =
        Clock.fixed(Instant.parse("2026-07-25T23:59:59Z"), ZoneOffset.UTC)

    @Test
    fun `uses the UTC date and configured feature units`() {
        val store = RecordingUsageStore(reservationId = 41)
        val service =
            DailyUsageQuotaService(
                store = store,
                limitPolicy = DailyUsageLimitPolicy { 60 },
                clock = clock,
            )

        val reservation =
            service.reserve(
                userId = 7,
                feature = UsageFeature.SPEECH_TRANSCRIPTION,
                units = 30,
            )

        assertEquals(
            ReserveCall(
                userId = 7,
                usageDate = LocalDate.parse("2026-07-25"),
                feature = UsageFeature.SPEECH_TRANSCRIPTION,
                units = 30,
                limit = 60,
                now = clock.instant(),
            ),
            store.reserveCalls.single(),
        )
        assertEquals(
            UsageReservation(41, UsageFeature.SPEECH_TRANSCRIPTION, 30),
            reservation,
        )
    }

    @Test
    fun `rejects disabled exhausted and invalid usage before a provider can run`() {
        val disabledStore = RecordingUsageStore(reservationId = 1)
        val disabledService =
            DailyUsageQuotaService(
                store = disabledStore,
                limitPolicy = DailyUsageLimitPolicy { 0 },
                clock = clock,
            )
        assertFailsWith<UsageLimitExceededException> {
            disabledService.reserve(7, UsageFeature.OCR, 1)
        }
        assertEquals(0, disabledStore.reserveCalls.size)

        val exhaustedService =
            DailyUsageQuotaService(
                store = RecordingUsageStore(reservationId = null),
                limitPolicy = DailyUsageLimitPolicy { 10 },
                clock = clock,
            )
        assertFailsWith<UsageLimitExceededException> {
            exhaustedService.reserve(7, UsageFeature.OCR, 1)
        }
        assertFailsWith<IllegalArgumentException> {
            exhaustedService.reserve(7, UsageFeature.OCR, 0)
        }
        assertFailsWith<IllegalArgumentException> {
            exhaustedService.reserve(0, UsageFeature.OCR, 1)
        }
    }
}

private class RecordingUsageStore(
    private val reservationId: Long?,
) : UsageReservationStore {
    val reserveCalls = mutableListOf<ReserveCall>()

    override fun tryReserve(
        userId: Long,
        usageDate: LocalDate,
        feature: UsageFeature,
        units: Long,
        limit: Long,
        now: Instant,
    ): Long? {
        reserveCalls += ReserveCall(userId, usageDate, feature, units, limit, now)
        return reservationId
    }

    override fun tryCommit(
        reservationId: Long,
        now: Instant,
    ): Boolean = error("Not used.")

    override fun tryRelease(
        reservationId: Long,
        now: Instant,
    ): UsageReleaseResult = error("Not used.")

    override fun findStatus(reservationId: Long): UsageReservationStatus? = error("Not used.")
}

private data class ReserveCall(
    val userId: Long,
    val usageDate: LocalDate,
    val feature: UsageFeature,
    val units: Long,
    val limit: Long,
    val now: Instant,
)
