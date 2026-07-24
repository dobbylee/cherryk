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

@Embeddable
data class UserTagStatId(
    @field:Column(name = "user_id", nullable = false)
    var userId: Long = 0,
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
