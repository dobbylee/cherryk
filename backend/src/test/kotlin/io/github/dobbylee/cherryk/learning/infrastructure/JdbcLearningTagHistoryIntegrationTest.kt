package io.github.dobbylee.cherryk.learning.infrastructure

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserEntity
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserJpaRepository
import io.github.dobbylee.cherryk.learning.api.TopLearningTags
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class JdbcLearningTagHistoryIntegrationTest(
    @Autowired private val learningTags: TopLearningTags,
    @Autowired private val userRepository: UserJpaRepository,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `returns known tags ordered by count and recency`() {
        val user = userRepository.save(UserEntity(displayName = "Learning tag reader"))
        insertTagStat(user.id, "particle_location", 2, "2026-07-20T00:00:00Z")
        insertTagStat(user.id, "unknown_future_tag", 10, "2026-07-22T00:00:00Z")
        insertTagStat(user.id, "particle_object", 2, "2026-07-21T00:00:00Z")

        assertEquals(
            listOf(GrammarTag.PARTICLE_OBJECT, GrammarTag.PARTICLE_LOCATION),
            learningTags.findTopTags(user.id),
        )
    }

    private fun insertTagStat(
        userId: Long,
        tag: String,
        count: Int,
        lastSeenAt: String,
    ) {
        jdbcClient
            .sql(
                """
                INSERT INTO user_tag_stats (user_id, tag, count, last_seen_at)
                VALUES (:userId, :tag, :count, :lastSeenAt::timestamptz)
                """.trimIndent(),
            ).param("userId", userId)
            .param("tag", tag)
            .param("count", count)
            .param("lastSeenAt", lastSeenAt)
            .update()
    }
}
