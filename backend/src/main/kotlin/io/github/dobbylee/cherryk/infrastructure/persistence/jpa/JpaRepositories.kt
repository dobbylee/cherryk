package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import org.springframework.data.jpa.repository.JpaRepository

interface UserJpaRepository : JpaRepository<UserEntity, Long> {
    fun findFirstByEmailIgnoreCase(email: String): UserEntity?
}

interface UserIdentityJpaRepository : JpaRepository<UserIdentityEntity, Long> {
    fun findByIssuerAndSubject(
        issuer: String,
        subject: String,
    ): UserIdentityEntity?
}

interface CorrectionJpaRepository : JpaRepository<CorrectionEntity, Long>

interface QuizJpaRepository : JpaRepository<QuizEntity, Long>

interface QuizAttemptJpaRepository : JpaRepository<QuizAttemptEntity, Long>
