package io.github.dobbylee.cherryk.application.usage

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset

@Service
class DailyUsageQuotaService(
    private val store: UsageReservationStore,
    private val limitPolicy: DailyUsageLimitPolicy,
    private val clock: Clock,
) : UsageQuota {
    @Transactional
    override fun reserve(
        userId: Long,
        feature: UsageFeature,
        units: Long,
    ): UsageReservation {
        require(userId > 0) { "Usage user id must be positive." }
        require(units > 0) { "Usage units must be positive." }
        val limit = limitPolicy.limitFor(feature)
        if (limit <= 0 || units > limit) {
            throw UsageLimitExceededException(feature)
        }
        val now = clock.instant()
        val usageDate = LocalDate.ofInstant(now, ZoneOffset.UTC)
        val reservationId =
            store.tryReserve(
                userId = userId,
                usageDate = usageDate,
                feature = feature,
                units = units,
                limit = limit,
                now = now,
            ) ?: throw UsageLimitExceededException(feature)
        return UsageReservation(
            id = reservationId,
            feature = feature,
            units = units,
        )
    }

    @Transactional
    override fun commit(reservation: UsageReservation) {
        if (store.tryCommit(reservation.id, clock.instant())) {
            return
        }
        when (store.findStatus(reservation.id)) {
            UsageReservationStatus.COMMITTED -> return
            UsageReservationStatus.RELEASED ->
                throw UsageReservationStateException(
                    "Released usage reservation ${reservation.id} cannot be committed.",
                )
            UsageReservationStatus.RESERVED ->
                throw UsageReservationStateException(
                    "Usage reservation ${reservation.id} could not be committed.",
                )
            null ->
                throw UsageReservationStateException(
                    "Usage reservation ${reservation.id} does not exist.",
                )
        }
    }

    @Transactional
    override fun release(reservation: UsageReservation) {
        when (store.tryRelease(reservation.id, clock.instant())) {
            UsageReleaseResult.RELEASED -> return
            UsageReleaseResult.INCONSISTENT ->
                throw UsageReservationStateException(
                    "Usage reservation ${reservation.id} has no matching counter.",
                )
            UsageReleaseResult.NO_CHANGE -> {
                when (store.findStatus(reservation.id)) {
                    UsageReservationStatus.RELEASED -> return
                    UsageReservationStatus.COMMITTED ->
                        throw UsageReservationStateException(
                            "Committed usage reservation ${reservation.id} cannot be released.",
                        )
                    UsageReservationStatus.RESERVED ->
                        throw UsageReservationStateException(
                            "Usage reservation ${reservation.id} could not be released.",
                        )
                    null ->
                        throw UsageReservationStateException(
                            "Usage reservation ${reservation.id} does not exist.",
                        )
                }
            }
        }
    }
}
