package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface UserJpaRepository : JpaRepository<UserEntity, UUID>

interface CorrectionJpaRepository : JpaRepository<CorrectionEntity, UUID>

interface QuizJpaRepository : JpaRepository<QuizEntity, UUID>

interface QuizAttemptJpaRepository : JpaRepository<QuizAttemptEntity, UUID>
