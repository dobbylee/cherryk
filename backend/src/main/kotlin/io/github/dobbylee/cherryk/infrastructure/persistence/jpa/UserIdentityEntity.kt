package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "user_identities")
class UserIdentityEntity(
    id: UUID = UUID.randomUUID(),
    issuer: String,
    subject: String,
    userId: UUID,
    createdAt: Instant,
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:Column(nullable = false, updatable = false, columnDefinition = "text")
    var issuer: String = issuer
        protected set

    @field:Column(nullable = false, updatable = false, columnDefinition = "text")
    var subject: String = subject
        protected set

    @field:Column(name = "user_id", nullable = false, updatable = false)
    var userId: UUID = userId
        protected set

    @field:Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant = createdAt
        protected set
}
