package io.github.dobbylee.cherryk.learning

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.auth.*
import io.github.dobbylee.cherryk.application.correction.*
import io.github.dobbylee.cherryk.application.quiz.*
import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.learning.api.*
import io.github.dobbylee.cherryk.learning.application.*
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.core.io.ClassPathResource
import tools.jackson.module.kotlin.jacksonObjectMapper
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.*
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.*
import java.util.UUID
import java.util.concurrent.Executors
import kotlin.test.*

@SpringBootTest
@AutoConfigureMockMvc
@Import(LearningTestClock::class)
class LearningRhythmIntegrationTest(
    @Autowired private val jdbc: JdbcClient,
    @Autowired private val identities: OidcIdentityResolver,
    @Autowired private val corrections: CorrectionPersistence,
    @Autowired private val recorder: LearningActivityRecorder,
    @Autowired private val history: LearningActivityHistory,
    @Autowired private val attempts: QuizAttemptService,
    @Autowired private val commands: QuizCommandService,
    @Autowired private val transactions: PlatformTransactionManager,
    @Autowired private val mvc: MockMvc,
) : PostgreSqlIntegrationTest() {
    private val userIds = mutableListOf<Long>()
    private val quizIds = mutableListOf<Long>()
    private val now = Instant.parse("2026-09-29T00:30:00Z")

    @AfterEach
    fun cleanup() {
        userIds.forEach { jdbc.sql("DELETE FROM users WHERE id = :id").param("id", it).update() }
        quizIds.forEach { jdbc.sql("DELETE FROM quiz_questions WHERE id = :id").param("id", it).update() }
    }

    @Test
    fun `activity uses local dates with multiple events counted once and no other users or future events`() {
        val (id) = user()
        correction(id, "2026-09-28T23:30:00Z")
        correction(id, "2026-09-29T00:10:00Z")
        correction(id, "2026-09-30T00:10:00Z")
        correction(user().first, "2026-09-27T12:00:00Z")
        val service = LearningRhythmService(history, Clock.fixed(now, ZoneOffset.UTC))
        val seoul = service.read(id, "Asia/Seoul")
        assertEquals("2026-09-29", seoul.today.toString())
        assertEquals(1, seoul.currentStreak)
        assertEquals(1, seoul.days.count { it.active })
        val la = service.read(id, "America/Los_Angeles")
        assertEquals("2026-09-28", la.today.toString())
        assertEquals(1, la.currentStreak)
        assertEquals(1, la.days.count { it.active })
        assertFailsWith<InvalidLearningTimeZone> { service.read(id, "Mars/Olympus") }
        assertFailsWith<InvalidLearningTimeZone> { service.read(id, "+09:00") }
    }

    @Test
    fun `DST transition and fractional offsets use actual local calendar days`() {
        val (id) = user()
        correction(id, "2026-11-01T05:30:00Z")
        correction(id, "2026-11-01T06:30:00Z")
        correction(id, "2026-11-02T05:30:00Z")
        val service = LearningRhythmService(history, Clock.fixed(Instant.parse("2026-11-02T06:00:00Z"), ZoneOffset.UTC))
        assertEquals(2, service.read(id, "America/New_York").currentStreak)
        val (nepal) = user()
        correction(nepal, "2026-09-28T18:20:00Z")
        val nepalService = LearningRhythmService(history, Clock.fixed(now, ZoneOffset.UTC))
        assertTrue(nepalService.read(nepal, "Asia/Kathmandu").days.last().active)
    }

    @Test
    fun `concurrent duplicate source recording is idempotent and deletions cascade`() {
        val (id) = user()
        val saved = correction(id)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val futures = (1..2).map {
                pool.submit {
                    TransactionTemplate(transactions).executeWithoutResult {
                        recorder.record(id, LearningActivitySource.CORRECTION, saved.correctionId, now)
                    }
                }
            }
            futures.forEach { it.get() }
        } finally { pool.shutdownNow() }
        assertEquals(1, count("learning_activities", id))
        jdbc.sql("DELETE FROM corrections WHERE id = :id").param("id", saved.correctionId).update()
        assertEquals(0, count("learning_activities", id))
        correction(id)
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", id).update()
        assertEquals(0, count("learning_activities", id))
    }

    @Test
    fun `only accepted quiz attempts record activity including wrong answers`() {
        val (id) = user()
        val (quiz, choice) = quiz()
        assertIs<QuizAttemptResult.Failure>(attempts.submit(QuizAttemptInput(id, quiz, Long.MAX_VALUE)))
        assertEquals(0, count("learning_activities", id))
        val result = assertIs<QuizAttemptResult.Success>(attempts.submit(QuizAttemptInput(id, quiz, choice)))
        assertFalse(result.value.correct)
        assertEquals(1, count("learning_activities", id))
        jdbc.sql("DELETE FROM quiz_attempts WHERE id = :id").param("id", result.value.attemptId).update()
        assertEquals(0, count("learning_activities", id))
    }

    @Test
    fun `activity insert failure rolls back both correction and quiz attempt`() {
        val (id) = user()
        val (quiz, choice) = quiz()
        jdbc.sql("ALTER TABLE learning_activities ADD CONSTRAINT test_activity_failure CHECK (user_id <> $id) NOT VALID").update()
        try {
            assertFails { correction(id) }
            assertFails { attempts.submit(QuizAttemptInput(id, quiz, choice)) }
            assertEquals(0, count("corrections", id))
            assertEquals(0, count("quiz_attempts", id))
            assertEquals(0, count("learning_activities", id))
        } finally {
            jdbc.sql("ALTER TABLE learning_activities DROP CONSTRAINT test_activity_failure").update()
        }
    }

    @Test
    fun `endpoint requires authentication validates zone and returns only own activity`() {
        val (id, subject) = user()
        correction(user().first, now.minusSeconds(5).toString())
        val login = oidcLogin().idToken { it.issuer(GOOGLE_ISSUER).subject(subject) }
        mvc.perform(get("/api/v1/learning/rhythm?timeZone=UTC")).andExpect(status().isUnauthorized)
        mvc.perform(get("/api/v1/learning/rhythm").with(login)).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_request"))
        mvc.perform(get("/api/v1/learning/rhythm?timeZone=Mars/Olympus").with(login)).andExpect(status().isBadRequest)
        mvc.perform(get("/api/v1/learning/rhythm?timeZone=UTC&userId=1").with(login))
            .andExpect(status().isOk).andExpect(header().string("Cache-Control", "no-store"))
            .andExpect(jsonPath("$.currentStreak").value(0)).andExpect(jsonPath("$.days.length()").value(7))
            .andExpect(jsonPath("$.userId").doesNotExist())
        correction(id, now.minusSeconds(2).toString())
        mvc.perform(get("/api/v1/learning/rhythm?timeZone=UTC").with(login)).andExpect(status().isOk)
            .andExpect(jsonPath("$.currentStreak").value(1)).andExpect(jsonPath("$.days[6].active").value(true))
    }

    @Test
    fun `endpoint matches the shared TypeScript contract fixture`() {
        val (id, subject) = user()
        correction(id, "2026-09-28T03:00:00Z")
        correction(id, "2026-09-29T00:10:00Z")
        val response = mvc.perform(get("/api/v1/learning/rhythm?timeZone=Asia/Seoul")
            .with(oidcLogin().idToken { it.issuer(GOOGLE_ISSUER).subject(subject) }))
            .andExpect(status().isOk).andReturn().response.contentAsString
        val mapper = jacksonObjectMapper()
        val fixture = ClassPathResource("api-v1.json").inputStream.use(mapper::readTree)
        assertEquals(fixture["learningRhythmResponse"], mapper.readTree(response))
    }

    private fun user(): Pair<Long, String> {
        val subject = "rhythm-${UUID.randomUUID()}"
        val user = identities.resolveOrCreate(OidcIdentityProfile(GOOGLE_ISSUER, subject, "$subject@example.com", true, "Rhythm test", null))
        userIds.add(user.id)
        return user.id to subject
    }

    private fun correction(id: Long, at: String = now.toString()) = corrections.persist(
        CorrectionPersistenceInput(id, CorrectionInputType.TEXT, "학습 문장", CorrectionResult("학습 문장", "Already correct.", emptyList()), Instant.parse(at)),
    )

    private fun count(table: String, userId: Long): Int = jdbc.sql("SELECT count(*) FROM $table WHERE user_id = :id").param("id", userId).query(Int::class.java).single()

    private fun quiz(): Pair<Long, Long> {
        val marker = UUID.randomUUID().toString()
        val content = QuizContent(
            GrammarTag.PARTICLE_OBJECT, UserLevel.BEGINNER, "Choose.", "문장 $marker",
            (0..3).map { QuizChoiceContent("답 $marker $it", it == 1, it) }, "Explanation.",
        )
        val id = commands.createDraft(content, now).quizId
        quizIds.add(id)
        commands.approveDraft(id, now)
        val wrongChoice = jdbc.sql("SELECT id FROM quiz_choices WHERE quiz_question_id = :id AND sort_order = 0").param("id", id).query(Long::class.java).single()
        return id to wrongChoice
    }
}

@TestConfiguration(proxyBeanMethods = false)
class LearningTestClock {
    @Bean
    @Primary
    fun learningClock(): Clock = Clock.fixed(Instant.parse("2026-09-29T00:30:00Z"), ZoneOffset.UTC)
}
