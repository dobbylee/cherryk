package io.github.dobbylee.cherryk.application.usage

import java.time.Instant
import java.time.LocalDate

enum class UsageFeature(
    val databaseValue: String,
) {
    CORRECTION("correction"),
    OCR("ocr"),
    SPEECH_TRANSCRIPTION("speech_transcription"),
    PRONUNCIATION_ASSESSMENT("pronunciation_assessment"),
}

enum class UsageReservationStatus(
    val databaseValue: String,
) {
    RESERVED("reserved"),
    COMMITTED("committed"),
    RELEASED("released"),
    ;

    companion object {
        fun fromDatabase(value: String): UsageReservationStatus =
            entries.firstOrNull { it.databaseValue == value }
                ?: error("Unsupported usage reservation status: $value")
    }
}

data class UsageReservation(
    val id: Long,
    val feature: UsageFeature,
    val units: Long,
)

interface UsageQuota {
    fun reserve(
        userId: Long,
        feature: UsageFeature,
        units: Long,
    ): UsageReservation

    fun commit(reservation: UsageReservation)

    fun release(reservation: UsageReservation)
}

fun interface DailyUsageLimitPolicy {
    fun limitFor(feature: UsageFeature): Long
}

interface UsageReservationStore {
    fun tryReserve(
        userId: Long,
        usageDate: LocalDate,
        feature: UsageFeature,
        units: Long,
        limit: Long,
        now: Instant,
    ): Long?

    fun tryCommit(
        reservationId: Long,
        now: Instant,
    ): Boolean

    fun tryRelease(
        reservationId: Long,
        now: Instant,
    ): UsageReleaseResult

    fun findStatus(reservationId: Long): UsageReservationStatus?
}

enum class UsageReleaseResult {
    NO_CHANGE,
    RELEASED,
    INCONSISTENT,
}

class UsageLimitExceededException(
    val feature: UsageFeature,
) : RuntimeException(feature.limitMessage) {
    val code = "daily_limit_reached"
}

class UsageReservationStateException(
    message: String,
) : RuntimeException(message)

private val UsageFeature.limitMessage: String
    get() =
        when (this) {
            UsageFeature.CORRECTION ->
                "Daily correction limit reached. Try again tomorrow."
            UsageFeature.OCR ->
                "Daily photo upload limit reached. Try again tomorrow."
            UsageFeature.SPEECH_TRANSCRIPTION,
            UsageFeature.PRONUNCIATION_ASSESSMENT,
            -> "Daily voice practice limit reached. Try again tomorrow."
        }
