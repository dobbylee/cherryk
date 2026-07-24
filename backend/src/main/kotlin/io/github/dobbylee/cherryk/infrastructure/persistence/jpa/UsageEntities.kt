package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Embeddable
import jakarta.persistence.EmbeddedId
import jakarta.persistence.Entity
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

@Embeddable
data class DailyUsageId(
    @field:Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    @field:Column(name = "usage_date", nullable = false)
    var usageDate: LocalDate = LocalDate.ofEpochDay(0),
) : Serializable

@Entity
@Table(name = "daily_usage")
class DailyUsageEntity(
    id: DailyUsageId,
    correctionCount: Int = 0,
    ocrCount: Int = 0,
    updatedAt: Instant = Instant.now(),
) {
    @field:EmbeddedId
    var id: DailyUsageId = id
        protected set

    @field:Column(name = "correction_count", nullable = false)
    var correctionCount: Int = correctionCount
        protected set

    @field:Column(name = "ocr_count", nullable = false)
    var ocrCount: Int = ocrCount
        protected set

    @field:Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        protected set
}

@Embeddable
data class UserTagStatId(
    @field:Column(name = "user_id", nullable = false)
    var userId: UUID = UUID(0, 0),
    @field:Convert(converter = GrammarTagConverter::class)
    @field:Column(name = "tag", nullable = false, columnDefinition = "text")
    var tag: GrammarTag = GrammarTag.PARTICLE_SUBJECT,
) : Serializable

@Entity
@Table(name = "user_tag_stats")
class UserTagStatEntity(
    id: UserTagStatId,
    count: Int = 0,
    lastSeenAt: Instant = Instant.now(),
) {
    @field:EmbeddedId
    var id: UserTagStatId = id
        protected set

    @field:Column(nullable = false)
    var count: Int = count
        protected set

    @field:Column(name = "last_seen_at", nullable = false)
    var lastSeenAt: Instant = lastSeenAt
        protected set
}
