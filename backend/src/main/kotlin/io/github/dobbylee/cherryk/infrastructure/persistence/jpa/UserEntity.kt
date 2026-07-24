package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.user.UserLevel
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "users")
class UserEntity(
    id: UUID = UUID.randomUUID(),
    displayName: String? = null,
    email: String? = null,
    emailVerified: Boolean = false,
    image: String? = null,
    level: UserLevel = UserLevel.BEGINNER,
    explanationLanguage: String = "en",
    createdAt: Instant = Instant.now(),
    updatedAt: Instant = createdAt,
    lastSeenAt: Instant? = null,
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:Column(name = "display_name", columnDefinition = "text")
    var displayName: String? = displayName
        protected set

    @field:Column(unique = true, columnDefinition = "text")
    var email: String? = email
        protected set

    @field:Column(name = "email_verified", nullable = false)
    var emailVerified: Boolean = emailVerified
        protected set

    @field:Column(columnDefinition = "text")
    var image: String? = image
        protected set

    @field:Convert(converter = UserLevelConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var level: UserLevel = level
        protected set

    @field:Column(name = "explanation_language", nullable = false, columnDefinition = "text")
    var explanationLanguage: String = explanationLanguage
        protected set

    @field:Column(name = "created_at", nullable = false)
    var createdAt: Instant = createdAt
        protected set

    @field:Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        protected set

    @field:Column(name = "last_seen_at")
    var lastSeenAt: Instant? = lastSeenAt
        protected set
}
