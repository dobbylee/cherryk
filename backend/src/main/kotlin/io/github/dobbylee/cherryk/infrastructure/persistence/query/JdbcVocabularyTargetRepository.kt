package io.github.dobbylee.cherryk.infrastructure.persistence.query

import io.github.dobbylee.cherryk.application.quiz.VocabularyTargetRepository
import io.github.dobbylee.cherryk.application.quiz.VocabularyTargetClaim
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
class JdbcVocabularyTargetRepository(
    private val jdbcClient: JdbcClient,
) : VocabularyTargetRepository {
    override fun claimUnusedTargets(
        difficulty: UserLevel,
        count: Int,
    ): VocabularyTargetClaim {
        require(count in 1..20) { "Vocabulary target count must be between 1 and 20." }
        val reservationKey = UUID.randomUUID().toString()

        val targets =
            jdbcClient
                .sql(
                    """
                    WITH available AS (
                        SELECT target.id
                        FROM vocabulary_targets target
                        WHERE target.difficulty = :difficulty
                          AND (
                            target.reservation_key IS NULL
                            OR target.reserved_at < now() - interval '15 minutes'
                          )
                          AND NOT EXISTS (
                            SELECT 1
                            FROM quiz_learning_targets history
                            WHERE history.quiz_type = :quizType
                              AND history.tag = 'word_choice'
                              AND history.target_digest = target.target_digest
                          )
                        ORDER BY target.id
                        LIMIT :count
                        FOR UPDATE SKIP LOCKED
                    )
                    UPDATE vocabulary_targets target
                    SET reservation_key = :reservationKey,
                        reserved_at = now()
                    FROM available
                    WHERE target.id = available.id
                    RETURNING target.id, target.word_ko
                    """.trimIndent(),
                ).param("difficulty", difficulty.databaseValue)
                .param("quizType", QuizType.VOCABULARY.databaseValue)
                .param("count", count)
                .param("reservationKey", reservationKey)
                .query { resultSet, _ ->
                    ClaimedTarget(
                        id = resultSet.getLong("id"),
                        word = resultSet.getString("word_ko"),
                    )
                }.list()
                .sortedBy(ClaimedTarget::id)
        return VocabularyTargetClaim(
            reservationKey = reservationKey,
            words = targets.map(ClaimedTarget::word),
        )
    }

    override fun releaseClaim(reservationKey: String) {
        require(reservationKey.isNotBlank()) { "Vocabulary reservation key must not be blank." }
        jdbcClient
            .sql(
                """
                UPDATE vocabulary_targets
                SET reservation_key = NULL,
                    reserved_at = NULL
                WHERE reservation_key = :reservationKey
                """.trimIndent(),
            ).param("reservationKey", reservationKey)
            .update()
    }
}

private data class ClaimedTarget(
    val id: Long,
    val word: String,
)
