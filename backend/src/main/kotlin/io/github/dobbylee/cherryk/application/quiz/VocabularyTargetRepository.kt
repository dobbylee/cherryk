package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.user.UserLevel

data class VocabularyTargetClaim(
    val reservationKey: String,
    val words: List<String>,
)

interface VocabularyTargetRepository {
    fun claimUnusedTargets(
        difficulty: UserLevel,
        count: Int,
    ): VocabularyTargetClaim

    fun releaseClaim(reservationKey: String)
}
