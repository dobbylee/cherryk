package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserEntity
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserJpaRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.simple.JdbcClient
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@SpringBootTest
class CorrectionPersistenceIntegrationTest(
    @Autowired private val persistence: CorrectionPersistence,
    @Autowired private val userRepository: UserJpaRepository,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `stores the edited text mistakes and unique tag stats atomically`() {
        val userId = createUser()
        val now = Instant.parse("2026-07-25T02:00:00Z")
        insertTagStat(
            userId = userId,
            tag = GrammarTag.PARTICLE_LOCATION,
            count = 2,
            lastSeenAt = Instant.parse("2026-07-24T02:00:00Z"),
        )
        val input =
            CorrectionPersistenceInput(
                userId = userId,
                inputType = CorrectionInputType.IMAGE_OCR,
                originalText = "제가 직접 고친 OCR 문장입니다.",
                output =
                    CorrectionResult(
                        correctedText = "제가 직접 고친 OCR 문장이에요.",
                        explanationEn = "Use the natural copula ending.",
                        mistakes =
                            listOf(
                                mistake(
                                    tag = GrammarTag.PARTICLE_LOCATION,
                                    originalPart = "입니다",
                                    correctedPart = "이에요",
                                ),
                                mistake(
                                    tag = GrammarTag.PARTICLE_LOCATION,
                                    originalPart = "",
                                    correctedPart = ".",
                                ),
                                mistake(
                                    tag = GrammarTag.SPACING,
                                    originalPart = "OCR문장",
                                    correctedPart = "OCR 문장",
                                ),
                            ),
                    ),
                now = now,
            )

        val persisted = persistence.persist(input)

        assertEquals(
            listOf(GrammarTag.PARTICLE_LOCATION, GrammarTag.SPACING),
            persisted.recommendedTags,
        )
        val correction =
            jdbcClient
                .sql(
                    """
                    SELECT user_id, input_type, original_text, corrected_text, explanation_en, created_at
                    FROM corrections
                    WHERE id = :id
                    """.trimIndent(),
                ).param("id", persisted.correctionId)
                .query { resultSet, _ ->
                    StoredCorrection(
                        userId = resultSet.getLong("user_id"),
                        inputType = resultSet.getString("input_type"),
                        originalText = resultSet.getString("original_text"),
                        correctedText = resultSet.getString("corrected_text"),
                        explanationEn = resultSet.getString("explanation_en"),
                        createdAt = resultSet.getObject("created_at", java.time.OffsetDateTime::class.java).toInstant(),
                    )
                }.single()
        assertEquals(userId, correction.userId)
        assertEquals("image_ocr", correction.inputType)
        assertEquals("제가 직접 고친 OCR 문장입니다.", correction.originalText)
        assertEquals("제가 직접 고친 OCR 문장이에요.", correction.correctedText)
        assertEquals("Use the natural copula ending.", correction.explanationEn)
        assertEquals(now, correction.createdAt)

        val storedMistakes =
            jdbcClient
                .sql(
                    """
                    SELECT tag, original_part, corrected_part, explanation_en, severity, created_at
                    FROM correction_mistakes
                    WHERE correction_id = :correctionId
                    ORDER BY id
                    """.trimIndent(),
                ).param("correctionId", persisted.correctionId)
                .query { resultSet, _ ->
                    StoredMistake(
                        tag = resultSet.getString("tag"),
                        originalPart = resultSet.getString("original_part"),
                        correctedPart = resultSet.getString("corrected_part"),
                        explanationEn = resultSet.getString("explanation_en"),
                        severity = resultSet.getString("severity"),
                        createdAt = resultSet.getObject("created_at", java.time.OffsetDateTime::class.java).toInstant(),
                    )
                }.list()
        assertEquals(3, storedMistakes.size)
        assertEquals("particle_location", storedMistakes[0].tag)
        assertEquals("입니다", storedMistakes[0].originalPart)
        assertEquals("이에요", storedMistakes[0].correctedPart)
        assertEquals("minor", storedMistakes[0].severity)
        assertEquals(now, storedMistakes[0].createdAt)
        assertEquals("spacing", storedMistakes[2].tag)

        assertEquals(
            StoredTagStat(count = 3, lastSeenAt = now),
            findTagStat(userId, GrammarTag.PARTICLE_LOCATION),
        )
        assertEquals(
            StoredTagStat(count = 1, lastSeenAt = now),
            findTagStat(userId, GrammarTag.SPACING),
        )
    }

    @Test
    fun `rolls back correction mistakes and tag updates when a tag increment fails`() {
        val userId = createUser()
        val originalText = "rollback-${UUID.randomUUID()}"
        val previousSeenAt = Instant.parse("2026-07-24T02:00:00Z")
        insertTagStat(
            userId = userId,
            tag = GrammarTag.SPACING,
            count = Int.MAX_VALUE,
            lastSeenAt = previousSeenAt,
        )

        assertFailsWith<DataAccessException> {
            persistence.persist(
                CorrectionPersistenceInput(
                    userId = userId,
                    inputType = CorrectionInputType.TEXT,
                    originalText = originalText,
                    output =
                        CorrectionResult(
                            correctedText = "고친 문장",
                            explanationEn = "A correction.",
                            mistakes =
                                listOf(
                                    mistake(
                                        tag = GrammarTag.SPACING,
                                        originalPart = "원문",
                                        correctedPart = "고친 문장",
                                    ),
                                ),
                        ),
                    now = Instant.parse("2026-07-25T02:00:00Z"),
                ),
            )
        }

        assertEquals(
            0L,
            jdbcClient
                .sql("SELECT count(*) FROM corrections WHERE original_text = :originalText")
                .param("originalText", originalText)
                .query(Long::class.java)
                .single(),
        )
        assertEquals(
            StoredTagStat(count = Int.MAX_VALUE, lastSeenAt = previousSeenAt),
            findTagStat(userId, GrammarTag.SPACING),
        )
    }

    @Test
    fun `keeps tag recency monotonic when an older correction finishes later`() {
        val userId = createUser()
        val newerSeenAt = Instant.parse("2026-07-25T03:00:00Z")
        val olderSeenAt = Instant.parse("2026-07-25T02:00:00Z")

        persistence.persist(
            persistenceInput(
                userId = userId,
                originalText = "newer-${UUID.randomUUID()}",
                now = newerSeenAt,
                tag = GrammarTag.WORD_CHOICE,
            ),
        )
        persistence.persist(
            persistenceInput(
                userId = userId,
                originalText = "older-${UUID.randomUUID()}",
                now = olderSeenAt,
                tag = GrammarTag.WORD_CHOICE,
            ),
        )

        assertEquals(
            StoredTagStat(count = 2, lastSeenAt = newerSeenAt),
            findTagStat(userId, GrammarTag.WORD_CHOICE),
        )
    }

    private fun createUser(): Long =
        userRepository
            .saveAndFlush(
                UserEntity(
                    displayName = "Correction persistence test",
                    email = "correction-${UUID.randomUUID()}@example.com",
                ),
            ).id

    private fun insertTagStat(
        userId: Long,
        tag: GrammarTag,
        count: Int,
        lastSeenAt: Instant,
    ) {
        jdbcClient
            .sql(
                """
                INSERT INTO user_tag_stats (user_id, tag, count, last_seen_at)
                VALUES (:userId, :tag, :count, :lastSeenAt)
                """.trimIndent(),
            ).param("userId", userId)
            .param("tag", tag.databaseValue)
            .param("count", count)
            .param("lastSeenAt", lastSeenAt.atOffset(ZoneOffset.UTC))
            .update()
    }

    private fun findTagStat(
        userId: Long,
        tag: GrammarTag,
    ): StoredTagStat =
        jdbcClient
            .sql(
                """
                SELECT count, last_seen_at
                FROM user_tag_stats
                WHERE user_id = :userId AND tag = :tag
                """.trimIndent(),
            ).param("userId", userId)
            .param("tag", tag.databaseValue)
            .query { resultSet, _ ->
                StoredTagStat(
                    count = resultSet.getInt("count"),
                    lastSeenAt = resultSet.getObject("last_seen_at", java.time.OffsetDateTime::class.java).toInstant(),
                )
            }.single()

    private fun persistenceInput(
        userId: Long,
        originalText: String,
        now: Instant,
        tag: GrammarTag,
    ) = CorrectionPersistenceInput(
        userId = userId,
        inputType = CorrectionInputType.TEXT,
        originalText = originalText,
        output =
            CorrectionResult(
                correctedText = "고친 문장",
                explanationEn = "A correction.",
                mistakes =
                    listOf(
                        mistake(
                            tag = tag,
                            originalPart = "원문",
                            correctedPart = "고친 문장",
                        ),
                    ),
            ),
        now = now,
    )
}

private data class StoredCorrection(
    val userId: Long,
    val inputType: String,
    val originalText: String,
    val correctedText: String,
    val explanationEn: String,
    val createdAt: Instant,
)

private data class StoredMistake(
    val tag: String,
    val originalPart: String,
    val correctedPart: String,
    val explanationEn: String,
    val severity: String,
    val createdAt: Instant,
)

private data class StoredTagStat(
    val count: Int,
    val lastSeenAt: Instant,
)

private fun mistake(
    tag: GrammarTag,
    originalPart: String,
    correctedPart: String,
) = CorrectionMistake(
    tag = tag,
    originalPart = originalPart,
    correctedPart = correctedPart,
    explanationEn = "A focused explanation.",
    severity = MistakeSeverity.MINOR,
)
