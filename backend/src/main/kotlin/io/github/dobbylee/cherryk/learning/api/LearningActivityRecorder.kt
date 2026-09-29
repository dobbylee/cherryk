package io.github.dobbylee.cherryk.learning.api

import java.time.Instant

enum class LearningActivitySource { CORRECTION, QUIZ_ATTEMPT }

fun interface LearningActivityRecorder {
    fun record(userId: Long, source: LearningActivitySource, sourceId: Long, occurredAt: Instant)
}
