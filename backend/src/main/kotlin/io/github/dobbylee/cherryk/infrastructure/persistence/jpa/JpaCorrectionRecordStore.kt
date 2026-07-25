package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.correction.CorrectionPersistenceInput
import io.github.dobbylee.cherryk.application.correction.CorrectionRecordStore
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.ZoneOffset

@Repository
class JpaCorrectionRecordStore(
    private val correctionRepository: CorrectionJpaRepository,
    private val jdbcClient: JdbcClient,
) : CorrectionRecordStore {
    override fun create(
        input: CorrectionPersistenceInput,
        recommendedTags: List<GrammarTag>,
    ): Long {
        val correction =
            CorrectionEntity(
                userId = input.userId,
                inputType = input.inputType,
                originalText = input.originalText,
                correctedText = input.output.correctedText,
                explanationEn = input.output.explanationEn,
                createdAt = input.now,
            ).apply {
                input.output.mistakes.forEach { mistake ->
                    addMistake(
                        tag = mistake.tag,
                        originalPart = mistake.originalPart,
                        correctedPart = mistake.correctedPart,
                        explanationEn = mistake.explanationEn,
                        severity = mistake.severity,
                        createdAt = input.now,
                    )
                }
            }
        val correctionId = correctionRepository.saveAndFlush(correction).id

        recommendedTags.forEach { tag ->
            incrementTagStat(
                userId = input.userId,
                tag = tag,
                now = input.now.atOffset(ZoneOffset.UTC),
            )
        }
        return correctionId
    }

    private fun incrementTagStat(
        userId: Long,
        tag: GrammarTag,
        now: java.time.OffsetDateTime,
    ) {
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
            .param("now", now)
            .update()
    }
}
