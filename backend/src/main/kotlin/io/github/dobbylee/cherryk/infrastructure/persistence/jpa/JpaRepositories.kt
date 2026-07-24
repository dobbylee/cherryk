package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserJpaRepository : JpaRepository<UserEntity, UUID> {
    fun findFirstByEmailIgnoreCase(email: String): UserEntity?
}

interface UserIdentityJpaRepository : JpaRepository<UserIdentityEntity, UUID> {
    fun findByIssuerAndSubject(
        issuer: String,
        subject: String,
    ): UserIdentityEntity?
}

interface CorrectionJpaRepository : JpaRepository<CorrectionEntity, UUID>

interface QuizJpaRepository : JpaRepository<QuizEntity, UUID>

interface QuizAttemptJpaRepository : JpaRepository<QuizAttemptEntity, UUID>
