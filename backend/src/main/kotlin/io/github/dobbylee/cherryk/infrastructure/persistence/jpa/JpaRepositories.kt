package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import jakarta.persistence.LockModeType

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

interface QuizJpaRepository : JpaRepository<QuizEntity, Long> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query(
        """
        SELECT DISTINCT quiz
        FROM QuizEntity quiz
        LEFT JOIN FETCH quiz.choiceEntities
        WHERE quiz.id = :id
        """,
    )
    fun findByIdForUpdate(
        @Param("id") id: Long,
    ): QuizEntity?
}

interface QuizAttemptJpaRepository : JpaRepository<QuizAttemptEntity, Long>
