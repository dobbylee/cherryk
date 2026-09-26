package io.github.dobbylee.cherryk.learning.infrastructure

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.learning.api.CorrectionTagRecorder
import io.github.dobbylee.cherryk.learning.api.TopLearningTags
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.time.ZoneOffset

@Repository
class JdbcLearningTagHistory(
    private val jdbcClient: JdbcClient,
) : CorrectionTagRecorder,
    TopLearningTags {
    override fun recordCorrectionTags(
        userId: Long,
        tags: List<GrammarTag>,
        now: Instant,
    ) {
        tags.forEach { tag ->
            jdbcClient
                .sql(
                    """
                    INSERT INTO user_tag_stats (
                        user_id, tag, count, last_seen_at
                    ) VALUES (
                        :userId, :tag, 1, :now
                    )
                    ON CONFLICT (user_id, tag)
                    DO UPDATE SET
                        count = user_tag_stats.count + 1,
                        last_seen_at = GREATEST(
                            user_tag_stats.last_seen_at,
                            EXCLUDED.last_seen_at
                        )
                    """.trimIndent(),
                ).param("userId", userId)
                .param("tag", tag.databaseValue)
                .param("now", now.atOffset(ZoneOffset.UTC))
                .update()
        }
    }

    override fun findTopTags(userId: Long): List<GrammarTag> =
        jdbcClient
            .sql(
                """
                SELECT tag
                FROM user_tag_stats
                WHERE user_id = :userId
                ORDER BY count DESC, last_seen_at DESC
                """.trimIndent(),
            ).param("userId", userId)
            .query { resultSet, _ -> resultSet.getString("tag") }
            .list()
            .mapNotNull(GrammarTag::fromDatabaseOrNull)
}
