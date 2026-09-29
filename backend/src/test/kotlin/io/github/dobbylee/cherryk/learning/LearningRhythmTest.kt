package io.github.dobbylee.cherryk.learning

import io.github.dobbylee.cherryk.learning.domain.LearningRhythm
import org.junit.jupiter.api.Test
import java.time.LocalDate
import kotlin.test.assertEquals

class LearningRhythmTest {
    private val today = LocalDate.parse("2026-09-29")

    @Test
    fun `streak can exceed displayed week and keeps yesterday until today ends`() {
        val dates = (1L..20L).map { today.minusDays(it) }.toSet()
        assertEquals(20, LearningRhythm.calculate("UTC", today, dates).currentStreak)
        assertEquals(21, LearningRhythm.calculate("UTC", today, dates + today).currentStreak)
        assertEquals(7, LearningRhythm.calculate("UTC", today, dates).days.size)
    }

    @Test
    fun `empty history a missed day and future dates do not fabricate a streak`() {
        assertEquals(0, LearningRhythm.calculate("UTC", today, emptySet()).currentStreak)
        assertEquals(0, LearningRhythm.calculate("UTC", today, setOf(today.minusDays(2), today.plusDays(1))).currentStreak)
        assertEquals(1, LearningRhythm.calculate("UTC", today, setOf(today, today.minusDays(2))).currentStreak)
    }
}
