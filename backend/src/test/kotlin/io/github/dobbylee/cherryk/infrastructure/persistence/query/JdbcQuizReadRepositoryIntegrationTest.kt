package io.github.dobbylee.cherryk.infrastructure.persistence.query

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.quiz.QuizReadRepository
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.QuizAttemptEntity
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.QuizAttemptJpaRepository
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.QuizEntity
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.QuizJpaRepository
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserEntity
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserJpaRepository
import jakarta.persistence.EntityManager
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class JdbcQuizReadRepositoryIntegrationTest(
    @Autowired private val readRepository: QuizReadRepository,
    @Autowired private val userRepository: UserJpaRepository,
    @Autowired private val quizRepository: QuizJpaRepository,
    @Autowired private val attemptRepository: QuizAttemptJpaRepository,
    @Autowired private val entityManager: EntityManager,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `read model matches the current Drizzle query semantics`() {
        val user = userRepository.save(UserEntity(displayName = "Read model friend"))
        val approved = createQuiz(status = QuizStatus.APPROVED, choiceCount = 4)
        val incomplete = createQuiz(status = QuizStatus.APPROVED, choiceCount = 3)
        val draft = createQuiz(status = QuizStatus.DRAFT, choiceCount = 4)
        quizRepository.saveAll(listOf(approved, incomplete, draft))

        attemptRepository.saveAll(
            listOf(
                QuizAttemptEntity(
                    userId = user.id,
                    quizQuestionId = approved.id,
                    selectedChoiceId = approved.choices[0].id,
                    correct = false,
                    createdAt = Instant.parse("2026-07-20T00:00:00Z"),
                ),
                QuizAttemptEntity(
                    userId = user.id,
                    quizQuestionId = approved.id,
                    selectedChoiceId = approved.choices[1].id,
                    correct = true,
                    createdAt = Instant.parse("2026-07-21T00:00:00Z"),
                ),
            ),
        )
        entityManager.flush()
        insertTagStat(user.id, "particle_location", 2, "2026-07-20T00:00:00Z")
        insertTagStat(user.id, "unknown_future_tag", 10, "2026-07-22T00:00:00Z")
        insertTagStat(user.id, "particle_object", 2, "2026-07-21T00:00:00Z")

        val quizzes = readRepository.findApprovedQuizzesByTags(emptySet())
        assertEquals(listOf(approved.id), quizzes.map { it.id })
        assertEquals(listOf("choice-0", "choice-1", "choice-2", "choice-3"), quizzes.single().choices.map { it.text })
        assertTrue(readRepository.findApprovedQuizzesByTags(setOf(GrammarTag.PARTICLE_SUBJECT)).isEmpty())

        assertEquals(
            listOf(
                io.github.dobbylee.cherryk.application.quiz.QuizAttemptSummary(
                    quizId = approved.id,
                    attemptCount = 2,
                    correctCount = 1,
                    lastAttemptCorrect = true,
                    lastAttemptedAt = Instant.parse("2026-07-21T00:00:00Z"),
                ),
            ),
            readRepository.findAttemptSummaries(user.id),
        )
        assertEquals(
            listOf(GrammarTag.PARTICLE_OBJECT, GrammarTag.PARTICLE_LOCATION),
            readRepository.findTopUserTags(user.id),
        )
    }

    private fun createQuiz(
        status: QuizStatus,
        choiceCount: Int,
    ): QuizEntity {
        val marker = UUID.randomUUID()
        return QuizEntity(
            id = marker,
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            contentFingerprint = "read-model-$marker",
            status = status,
            questionEn = "Choose.",
            sentenceKo = "저는 물( ) 마셔요.",
            answerExplanationEn = "Use 을.",
            createdAt = Instant.parse("2026-07-19T00:00:00Z").plusMillis(marker.leastSignificantBits and 1023),
            updatedAt = Instant.parse("2026-07-19T00:00:00Z"),
        ).apply {
            repeat(choiceCount) { index ->
                addChoice(
                    text = "choice-$index",
                    correct = index == 1,
                    sortOrder = index,
                )
            }
        }
    }

    private fun insertTagStat(
        userId: UUID,
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
