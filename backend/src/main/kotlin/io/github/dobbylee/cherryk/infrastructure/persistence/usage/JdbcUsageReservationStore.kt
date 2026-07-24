package io.github.dobbylee.cherryk.infrastructure.persistence.usage

import io.github.dobbylee.cherryk.application.usage.UsageFeature
import io.github.dobbylee.cherryk.application.usage.UsageReleaseResult
import io.github.dobbylee.cherryk.application.usage.UsageReservationStatus
import io.github.dobbylee.cherryk.application.usage.UsageReservationStore
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@Repository
class JdbcUsageReservationStore(
    private val jdbcClient: JdbcClient,
) : UsageReservationStore {
    override fun tryReserve(
        userId: Long,
        usageDate: LocalDate,
        feature: UsageFeature,
        units: Long,
        limit: Long,
        now: Instant,
    ): Long? =
        jdbcClient
            .sql(
                """
                WITH reserved_counter AS (
                    INSERT INTO usage_counters (
                        user_id, usage_date, feature, units, updated_at
                    ) VALUES (
                        :userId, :usageDate, :feature, :units, :now
                    )
                    ON CONFLICT (user_id, usage_date, feature)
                    DO UPDATE SET
                        units = usage_counters.units + EXCLUDED.units,
                        updated_at = EXCLUDED.updated_at
                    WHERE usage_counters.units <= :limit - EXCLUDED.units
                    RETURNING user_id
                )
                INSERT INTO usage_reservations (
                    user_id, usage_date, feature, units, status, created_at, updated_at
                )
                SELECT
                    :userId, :usageDate, :feature, :units, 'reserved', :now, :now
                FROM reserved_counter
                RETURNING id
                """.trimIndent(),
            ).param("userId", userId)
            .param("usageDate", usageDate)
            .param("feature", feature.databaseValue)
            .param("units", units)
            .param("limit", limit)
            .param("now", now.atOffset(ZoneOffset.UTC))
            .query { resultSet, _ -> resultSet.getLong("id") }
            .optional()
            .orElse(null)

    override fun tryCommit(
        reservationId: Long,
        now: Instant,
    ): Boolean =
        jdbcClient
            .sql(
                """
                UPDATE usage_reservations
                SET status = 'committed', updated_at = :now
                WHERE id = :reservationId
                  AND status = 'reserved'
                """.trimIndent(),
            ).param("reservationId", reservationId)
            .param("now", now.atOffset(ZoneOffset.UTC))
            .update() == 1

    override fun tryRelease(
        reservationId: Long,
        now: Instant,
    ): UsageReleaseResult =
        jdbcClient
            .sql(
                """
                WITH released_reservation AS (
                    UPDATE usage_reservations
                    SET status = 'released', updated_at = :now
                    WHERE id = :reservationId
                      AND status = 'reserved'
                    RETURNING user_id, usage_date, feature, units
                ),
                updated_counter AS (
                    UPDATE usage_counters counter
                    SET
                        units = counter.units - released.units,
                        updated_at = :now
                    FROM released_reservation released
                    WHERE counter.user_id = released.user_id
                      AND counter.usage_date = released.usage_date
                      AND counter.feature = released.feature
                      AND counter.units >= released.units
                    RETURNING counter.user_id
                )
                SELECT
                    (SELECT count(*) FROM released_reservation) AS released_count,
                    (SELECT count(*) FROM updated_counter) AS updated_count
                """.trimIndent(),
            ).param("reservationId", reservationId)
            .param("now", now.atOffset(ZoneOffset.UTC))
            .query { resultSet, _ ->
                val releasedCount = resultSet.getInt("released_count")
                val updatedCount = resultSet.getInt("updated_count")
                when {
                    releasedCount == 0 -> UsageReleaseResult.NO_CHANGE
                    updatedCount == 1 -> UsageReleaseResult.RELEASED
                    else -> UsageReleaseResult.INCONSISTENT
                }
            }.single()

    override fun findStatus(reservationId: Long): UsageReservationStatus? =
        jdbcClient
            .sql(
                """
                SELECT status
                FROM usage_reservations
                WHERE id = :reservationId
                """.trimIndent(),
            ).param("reservationId", reservationId)
            .query { resultSet, _ ->
                UsageReservationStatus.fromDatabase(resultSet.getString("status"))
            }.optional()
            .orElse(null)
}
