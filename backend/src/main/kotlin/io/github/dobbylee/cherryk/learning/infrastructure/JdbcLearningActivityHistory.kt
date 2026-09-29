package io.github.dobbylee.cherryk.learning.infrastructure

import io.github.dobbylee.cherryk.learning.api.LearningActivityRecorder
import io.github.dobbylee.cherryk.learning.api.LearningActivitySource
import io.github.dobbylee.cherryk.learning.application.LearningActivityHistory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@Repository
class JdbcLearningActivityHistory(private val jdbc: JdbcClient) : LearningActivityRecorder, LearningActivityHistory {
    @Transactional(propagation = Propagation.MANDATORY)
    override fun record(userId: Long, source: LearningActivitySource, sourceId: Long, occurredAt: Instant) {
        val column = when (source) {
            LearningActivitySource.CORRECTION -> "correction_id"
            LearningActivitySource.QUIZ_ATTEMPT -> "quiz_attempt_id"
        }
        jdbc.sql(
            """
            INSERT INTO learning_activities (user_id, $column, occurred_at)
            VALUES (:userId, :sourceId, :occurredAt)
            ON CONFLICT ($column) DO NOTHING
            """.trimIndent(),
        ).param("userId", userId)
            .param("sourceId", sourceId)
            .param("occurredAt", occurredAt.atOffset(ZoneOffset.UTC))
            .update()
    }

    override fun supportsTimeZone(timeZone: String): Boolean =
        jdbc.sql("SELECT EXISTS (SELECT 1 FROM pg_timezone_names WHERE name = :timeZone)")
            .param("timeZone", timeZone).query(Boolean::class.java).single()

    override fun activeDates(userId: Long, timeZone: String, through: Instant): Set<LocalDate> =
        jdbc.sql(
            """
            SELECT DISTINCT (occurred_at AT TIME ZONE :timeZone)::date AS active_date
            FROM learning_activities
            WHERE user_id = :userId AND occurred_at <= :through
            """.trimIndent(),
        ).param("userId", userId)
            .param("timeZone", timeZone)
            .param("through", through.atOffset(ZoneOffset.UTC))
            .query { rs, _ -> rs.getObject("active_date", LocalDate::class.java) }
            .list().toSet()
}
