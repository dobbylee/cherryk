package io.github.dobbylee.cherryk.learning.api

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import java.time.Instant

interface CorrectionTagRecorder {
    fun recordCorrectionTags(
        userId: Long,
        tags: List<GrammarTag>,
        now: Instant,
    )
}

fun interface TopLearningTags {
    fun findTopTags(userId: Long): List<GrammarTag>
}
