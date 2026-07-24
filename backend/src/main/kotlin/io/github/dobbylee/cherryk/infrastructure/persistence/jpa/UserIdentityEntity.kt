package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "user_identities")
class UserIdentityEntity(
    issuer: String,
    subject: String,
    userId: Long,
    createdAt: Instant,
) {
    @field:Id
    @field:GeneratedValue(strategy = GenerationType.IDENTITY)
    @field:Column(nullable = false, updatable = false)
    var id: Long = 0
        protected set

    @field:Column(nullable = false, updatable = false, columnDefinition = "text")
    var issuer: String = issuer
        protected set

    @field:Column(nullable = false, updatable = false, columnDefinition = "text")
    var subject: String = subject
        protected set

    @field:Column(name = "user_id", nullable = false, updatable = false)
    var userId: Long = userId
        protected set

    @field:Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant = createdAt
        protected set
}
