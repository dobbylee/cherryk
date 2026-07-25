package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param

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
    @Query(
        """
        SELECT CASE WHEN COUNT(quiz) > 0 THEN true ELSE false END
        FROM QuizEntity quiz
        WHERE quiz.contentFingerprint = :fingerprint
          AND (
            quiz.status = :approvedStatus
            OR (
              quiz.status = :draftStatus
              AND quiz.supersedesQuizId IS NULL
            )
          )
        """,
    )
    fun existsActiveByFingerprint(
        @Param("fingerprint") fingerprint: String,
        @Param("approvedStatus") approvedStatus: QuizStatus,
        @Param("draftStatus") draftStatus: QuizStatus,
    ): Boolean

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
