package io.github.dobbylee.cherryk.learning.domain

import java.time.LocalDate

data class LearningDay(val date: LocalDate, val active: Boolean)

data class LearningRhythm(
    val timeZone: String,
    val today: LocalDate,
    val currentStreak: Int,
    val days: List<LearningDay>,
) {
    companion object {
        fun calculate(timeZone: String, today: LocalDate, activeDates: Set<LocalDate>): LearningRhythm {
            var cursor = if (today in activeDates) today else today.minusDays(1)
            var streak = 0
            while (cursor in activeDates) {
                streak++
                cursor = cursor.minusDays(1)
            }
            return LearningRhythm(
                timeZone, today, streak,
                (6L downTo 0L).map { offset ->
                    val day = today.minusDays(offset)
                    LearningDay(day, day in activeDates)
                },
            )
        }
    }
}
