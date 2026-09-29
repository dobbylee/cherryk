package io.github.dobbylee.cherryk.learning.application

import io.github.dobbylee.cherryk.learning.domain.LearningRhythm
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

interface LearningActivityHistory {
    fun supportsTimeZone(timeZone: String): Boolean
    fun activeDates(userId: Long, timeZone: String, through: Instant): Set<LocalDate>
}

class InvalidLearningTimeZone : RuntimeException()

@Service
class LearningRhythmService(
    private val history: LearningActivityHistory,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun read(userId: Long, timeZone: String): LearningRhythm {
        if (timeZone !in ZoneId.getAvailableZoneIds() || !history.supportsTimeZone(timeZone)) {
            throw InvalidLearningTimeZone()
        }
        val now = clock.instant()
        val today = now.atZone(ZoneId.of(timeZone)).toLocalDate()
        return LearningRhythm.calculate(timeZone, today, history.activeDates(userId, timeZone, now))
    }
}
