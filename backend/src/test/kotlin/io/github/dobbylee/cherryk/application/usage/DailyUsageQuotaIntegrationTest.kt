package io.github.dobbylee.cherryk.application.usage

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserEntity
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserJpaRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.jdbc.core.simple.JdbcClient
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertIs

@SpringBootTest(
    properties = [
        "cherryk.usage.daily-limits.ocr=10",
        "cherryk.usage.daily-limits.speech_transcription=60",
    ],
)
@Import(FixedUsageClockConfiguration::class)
class DailyUsageQuotaIntegrationTest(
    @Autowired private val quota: UsageQuota,
    @Autowired private val userRepository: UserJpaRepository,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `concurrent reservations never exceed the daily feature limit`() {
        val user = userRepository.save(UserEntity(displayName = "Concurrent usage"))
        val executor = Executors.newFixedThreadPool(20)
        val ready = CountDownLatch(20)
        val start = CountDownLatch(1)
        try {
            val futures =
                (1..20).map {
                    executor.submit<Result<UsageReservation>> {
                        ready.countDown()
                        start.await()
                        runCatching {
                            quota.reserve(user.id, UsageFeature.OCR, 1)
                        }
                    }
                }
            ready.await()
            start.countDown()
            val results = futures.map { it.get() }

            assertEquals(10, results.count { it.isSuccess })
            assertEquals(10, results.count { it.isFailure })
            results
                .mapNotNull { it.exceptionOrNull() }
                .forEach { assertIs<UsageLimitExceededException>(it) }
            assertEquals(10, counterUnits(user.id, UsageFeature.OCR))
            assertEquals(10, reservationCount(user.id, UsageFeature.OCR, "reserved"))
        } finally {
            executor.shutdownNow()
        }
    }

    @Test
    fun `commit and release are idempotent and release restores quota`() {
        val user = userRepository.save(UserEntity(displayName = "Lifecycle usage"))
        val committed = quota.reserve(user.id, UsageFeature.OCR, 1)
        val released = quota.reserve(user.id, UsageFeature.OCR, 1)

        quota.commit(committed)
        quota.commit(committed)
        quota.release(released)
        quota.release(released)

        assertEquals(1, counterUnits(user.id, UsageFeature.OCR))
        assertEquals("committed", reservationStatus(committed.id))
        assertEquals("released", reservationStatus(released.id))
        assertFailsWith<UsageReservationStateException> {
            quota.release(committed)
        }
        assertFailsWith<UsageReservationStateException> {
            quota.commit(released)
        }
        assertEquals(1, counterUnits(user.id, UsageFeature.OCR))
    }

    @Test
    fun `duration units share the same atomic quota model`() {
        val user = userRepository.save(UserEntity(displayName = "Voice usage"))
        val first = quota.reserve(user.id, UsageFeature.SPEECH_TRANSCRIPTION, 30)
        quota.commit(first)
        val second = quota.reserve(user.id, UsageFeature.SPEECH_TRANSCRIPTION, 30)

        assertFailsWith<UsageLimitExceededException> {
            quota.reserve(user.id, UsageFeature.SPEECH_TRANSCRIPTION, 1)
        }
        quota.release(second)
        val replacement = quota.reserve(user.id, UsageFeature.SPEECH_TRANSCRIPTION, 30)
        quota.commit(replacement)

        assertEquals(60, counterUnits(user.id, UsageFeature.SPEECH_TRANSCRIPTION))
    }

    private fun counterUnits(
        userId: Long,
        feature: UsageFeature,
    ): Long =
        jdbcClient
            .sql(
                """
                SELECT units
                FROM usage_counters
                WHERE user_id = :userId
                  AND usage_date = '2026-07-25'
                  AND feature = :feature
                """.trimIndent(),
            ).param("userId", userId)
            .param("feature", feature.databaseValue)
            .query(Long::class.java)
            .single()

    private fun reservationCount(
        userId: Long,
        feature: UsageFeature,
        status: String,
    ): Int =
        jdbcClient
            .sql(
                """
                SELECT count(*)::int
                FROM usage_reservations
                WHERE user_id = :userId
                  AND usage_date = '2026-07-25'
                  AND feature = :feature
                  AND status = :status
                """.trimIndent(),
            ).param("userId", userId)
            .param("feature", feature.databaseValue)
            .param("status", status)
            .query(Int::class.java)
            .single()

    private fun reservationStatus(reservationId: Long): String =
        jdbcClient
            .sql("SELECT status FROM usage_reservations WHERE id = :reservationId")
            .param("reservationId", reservationId)
            .query(String::class.java)
            .single()
}

@TestConfiguration
class FixedUsageClockConfiguration {
    @Bean
    @Primary
    fun fixedUsageClock(): Clock =
        Clock.fixed(Instant.parse("2026-07-25T00:00:00Z"), ZoneOffset.UTC)
}
