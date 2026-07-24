package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizSource
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
import jakarta.persistence.EntityManager
import jakarta.persistence.EntityManagerFactory
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest
@Transactional
class JpaMappingIntegrationTest(
    @Autowired private val userRepository: UserJpaRepository,
    @Autowired private val correctionRepository: CorrectionJpaRepository,
    @Autowired private val quizRepository: QuizJpaRepository,
    @Autowired private val attemptRepository: QuizAttemptJpaRepository,
    @Autowired private val entityManager: EntityManager,
    @Autowired private val entityManagerFactory: EntityManagerFactory,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `application entities round-trip against the Drizzle baseline`() {
        val now = Instant.parse("2026-07-24T00:00:00Z")
        val user =
            userRepository.save(
                UserEntity(
                    displayName = "Spring friend",
                    email = "spring-friend@example.com",
                    emailVerified = true,
                    level = UserLevel.LOWER_INTERMEDIATE,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        val correction =
            CorrectionEntity(
                userId = user.id,
                inputType = CorrectionInputType.TEXT,
                originalText = "저는 학교에 공부했어요.",
                correctedText = "저는 학교에서 공부했어요.",
                explanationEn = "Use 에서 for an action location.",
                createdAt = now,
            ).apply {
                addMistake(
                    tag = GrammarTag.PARTICLE_LOCATION,
                    originalPart = "학교에",
                    correctedPart = "학교에서",
                    explanationEn = "The action happens at school.",
                    severity = MistakeSeverity.MINOR,
                    createdAt = now,
                )
            }
        correctionRepository.save(correction)

        val quiz =
            QuizEntity(
                tag = GrammarTag.PARTICLE_LOCATION,
                difficulty = UserLevel.BEGINNER,
                contentFingerprint = "jpa-mapping-${UUID.randomUUID()}",
                status = QuizStatus.APPROVED,
                questionEn = "Choose the action-location particle.",
                sentenceKo = "저는 학교( ) 공부해요.",
                answerExplanationEn = "Use 에서.",
                source = QuizSource.SEED,
                createdAt = now,
                updatedAt = now,
            ).apply {
                addChoice("에", false, 0)
                addChoice("에서", true, 1)
                addChoice("을", false, 2)
                addChoice("는", false, 3)
            }
        quizRepository.save(quiz)
        attemptRepository.save(
            QuizAttemptEntity(
                userId = user.id,
                quizQuestionId = quiz.id,
                selectedChoiceId = quiz.choices[1].id,
                correct = true,
                createdAt = now,
            ),
        )
        entityManager.persist(
            DailyUsageEntity(
                id = DailyUsageId(user.id, LocalDate.parse("2026-07-24")),
                correctionCount = 1,
                ocrCount = 0,
                updatedAt = now,
            ),
        )
        entityManager.persist(
            UserTagStatEntity(
                id = UserTagStatId(user.id, GrammarTag.PARTICLE_LOCATION),
                count = 1,
                lastSeenAt = now,
            ),
        )

        entityManager.flush()
        entityManager.clear()

        val reloadedUser = userRepository.findById(user.id).orElseThrow()
        assertEquals(UserLevel.LOWER_INTERMEDIATE, reloadedUser.level)

        val reloadedCorrection = correctionRepository.findById(correction.id).orElseThrow()
        assertFalse(
            entityManagerFactory.persistenceUnitUtil.isLoaded(
                reloadedCorrection,
                "mistakeEntities",
            ),
        )
        assertEquals(GrammarTag.PARTICLE_LOCATION, reloadedCorrection.mistakes.single().tag)

        val reloadedQuiz = quizRepository.findById(quiz.id).orElseThrow()
        assertFalse(entityManagerFactory.persistenceUnitUtil.isLoaded(reloadedQuiz, "choiceEntities"))
        assertEquals(4, reloadedQuiz.choices.size)
        assertEquals(1, reloadedQuiz.choices.count { it.correct })
        assertTrue(entityManagerFactory.persistenceUnitUtil.isLoaded(reloadedQuiz, "choiceEntities"))

        val reloadedAttempt = attemptRepository.findAll().single()
        assertNotNull(reloadedAttempt.selectedChoiceId)
        assertTrue(reloadedAttempt.correct)

        val usage =
            entityManager.find(
                DailyUsageEntity::class.java,
                DailyUsageId(user.id, LocalDate.parse("2026-07-24")),
            )
        assertEquals(1, usage.correctionCount)
        val tagStat =
            entityManager.find(
                UserTagStatEntity::class.java,
                UserTagStatId(user.id, GrammarTag.PARTICLE_LOCATION),
            )
        assertEquals(1, tagStat.count)
    }
}
