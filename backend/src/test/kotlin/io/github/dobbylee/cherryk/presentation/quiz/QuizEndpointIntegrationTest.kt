package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import io.github.dobbylee.cherryk.application.quiz.QuizCommandService
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse

@SpringBootTest
@AutoConfigureMockMvc
class QuizEndpointIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val identityResolver: OidcIdentityResolver,
    @Autowired private val commands: QuizCommandService,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    private val objectMapper = jacksonObjectMapper()

    @AfterEach
    fun deleteTestData() {
        jdbcClient
            .sql("DELETE FROM users WHERE display_name LIKE 'Quiz endpoint test:%'")
            .update()
        jdbcClient
            .sql("DELETE FROM quiz_questions WHERE answer_explanation_en LIKE 'Quiz endpoint test:%'")
            .update()
    }

    @Test
    fun `recommendation returns approved public fields and opaque ids only`() {
        val user = createUser()
        val approved = createQuiz(GrammarTag.PARTICLE_OBJECT, approved = true)
        createQuiz(GrammarTag.SPACING, approved = false)

        val response =
            mockMvc
                .perform(
                    get("$RECOMMEND_PATH?tags=particle_object,spacing")
                        .with(oidcUser(user.subject)),
                ).andExpect(status().isOk)
                .andExpect(jsonPath("$.quizzes.length()").value(1))
                .andExpect(jsonPath("$.quizzes[0].id").value(approved.id.toString()))
                .andExpect(jsonPath("$.quizzes[0].choices.length()").value(4))
                .andExpect(jsonPath("$.quizzes[0].attemptCount").value(0))
                .andExpect(jsonPath("$.availableTags[0]").value("particle_object"))
                .andExpect(jsonPath("$.activeTags[0]").value("particle_object"))
                .andExpect(jsonPath("$.progress.solvedCount").value(0))
                .andExpect(jsonPath("$.progress.totalCount").value(1))
                .andReturn()
                .response
        val payload = response.contentAsString

        assertFalse(payload.contains("isCorrect"))
        assertFalse(payload.contains("answerExplanationEn"))
        assertFalse(payload.contains("\"status\""))
    }

    @Test
    fun `missing tags use user stats while an explicit empty list uses all quizzes`() {
        val user = createUser()
        createQuiz(GrammarTag.PARTICLE_OBJECT, approved = true)
        createQuiz(GrammarTag.SPACING, approved = true)
        jdbcClient
            .sql(
                """
                INSERT INTO user_tag_stats (user_id, tag, count, last_seen_at)
                VALUES (:userId, 'spacing', 2, now())
                """.trimIndent(),
            ).param("userId", user.id)
            .update()

        mockMvc
            .perform(get(RECOMMEND_PATH).with(oidcUser(user.subject)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.quizzes.length()").value(1))
            .andExpect(jsonPath("$.quizzes[0].tag").value("spacing"))
            .andExpect(jsonPath("$.activeTags[0]").value("spacing"))

        mockMvc
            .perform(get("$RECOMMEND_PATH?tags=").with(oidcUser(user.subject)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.quizzes.length()").value(2))
            .andExpect(jsonPath("$.activeTags.length()").value(0))
    }

    @Test
    fun `vocabulary recommendations are isolated and omit the Korean sentence`() {
        val user = createUser()
        createQuiz(GrammarTag.PARTICLE_OBJECT, approved = true)
        val vocabulary =
            createQuiz(
                tag = GrammarTag.WORD_CHOICE,
                approved = true,
                quizType = QuizType.VOCABULARY,
            )

        mockMvc
            .perform(get("$RECOMMEND_PATH?type=vocabulary").with(oidcUser(user.subject)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.quizzes.length()").value(1))
            .andExpect(jsonPath("$.quizzes[0].id").value(vocabulary.id.toString()))
            .andExpect(jsonPath("$.quizzes[0].quizType").value("vocabulary"))
            .andExpect(jsonPath("$.quizzes[0].sentenceKo").value(nullValue()))
            .andExpect(jsonPath("$.progress.totalCount").value(1))
    }

    @Test
    fun `attempt records the selected owned choice and reveals the answer only after submission`() {
        val user = createUser()
        val quiz = createQuiz(GrammarTag.PARTICLE_OBJECT, approved = true)
        val choices = choiceIds(quiz.id)
        val selectedChoiceId = choices.first { !it.correct }.id
        val correctChoiceId = choices.single(StoredChoice::correct).id

        mockMvc
            .perform(
                post(ATTEMPT_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "quizId": "${quiz.id}",
                          "selectedChoiceId": "$selectedChoiceId"
                        }
                        """.trimIndent(),
                    ).with(oidcUser(user.subject))
                    .with(csrf()),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.isCorrect").value(false))
            .andExpect(jsonPath("$.correctChoiceId").value(correctChoiceId.toString()))
            .andExpect(jsonPath("$.explanationEn").value(quiz.content.answerExplanationEn))

        assertEquals(
            1,
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM quiz_attempts
                    WHERE user_id = :userId
                      AND quiz_question_id = :quizId
                      AND selected_choice_id = :choiceId
                      AND NOT is_correct
                    """.trimIndent(),
                ).param("userId", user.id)
                .param("quizId", quiz.id)
                .param("choiceId", selectedChoiceId)
                .query(Int::class.java)
                .single(),
        )
    }

    @Test
    fun `attempt rejects another quiz choice and unavailable drafts without writes`() {
        val user = createUser()
        val approved = createQuiz(GrammarTag.PARTICLE_OBJECT, approved = true)
        val other = createQuiz(GrammarTag.SPACING, approved = true)
        val draft = createQuiz(GrammarTag.PARTICLE_TOPIC, approved = false)

        mockMvc
            .perform(attemptRequest(user.subject, approved.id, choiceIds(other.id).first().id))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_choice"))

        mockMvc
            .perform(attemptRequest(user.subject, draft.id, choiceIds(draft.id).first().id))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error.code").value("quiz_not_available"))

        assertEquals(
            0,
            jdbcClient
                .sql("SELECT count(*) FROM quiz_attempts WHERE user_id = :userId")
                .param("userId", user.id)
                .query(Int::class.java)
                .single(),
        )
    }

    @Test
    fun `authentication CSRF and request validation preserve public errors`() {
        mockMvc
            .perform(get(RECOMMEND_PATH))
            .andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("unauthorized"))

        mockMvc
            .perform(
                get("$RECOMMEND_PATH?tags=not_allowed")
                    .with(oidcUser("missing-${UUID.randomUUID()}")),
            ).andExpect(status().isUnauthorized)

        val user = createUser()
        mockMvc
            .perform(
                get("$RECOMMEND_PATH?tags=not_allowed")
                    .with(oidcUser(user.subject)),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.code").value("invalid_request"))

        mockMvc
            .perform(
                post(ATTEMPT_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"quizId":"1","selectedChoiceId":"1"}""")
                    .with(oidcUser(user.subject)),
            ).andExpect(status().isForbidden)

        listOf(
            """{"quizId":"0","selectedChoiceId":"1"}""",
            """{"quizId":"1","selectedChoiceId":"not-an-id"}""",
            """{"quizId":1,"selectedChoiceId":"1"}""",
            "[]",
        ).forEach { body ->
            mockMvc
                .perform(
                    post(ATTEMPT_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body)
                        .with(oidcUser(user.subject))
                        .with(csrf()),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error.code").value("invalid_request"))
        }
    }

    private fun createUser(): TestUser {
        val subject = "quiz-${UUID.randomUUID()}"
        val user =
            identityResolver.resolveOrCreate(
                OidcIdentityProfile(
                    issuer = GOOGLE_ISSUER,
                    subject = subject,
                    email = null,
                    emailVerified = false,
                    displayName = "Quiz endpoint test: $subject",
                    image = null,
                ),
            )
        return TestUser(id = user.id, subject = subject)
    }

    private fun createQuiz(
        tag: GrammarTag,
        approved: Boolean,
        quizType: QuizType = QuizType.GRAMMAR,
    ): EndpointQuizFixture {
        val marker = UUID.randomUUID().toString()
        val vocabularyMarker = marker.filter(Char::isDigit).take(8)
        val content =
            QuizContent(
                tag = tag,
                difficulty = UserLevel.BEGINNER,
                questionEn =
                    if (quizType == QuizType.VOCABULARY) {
                        "A place where people can borrow books, reference $marker."
                    } else {
                        "Choose the correct answer."
                    },
                sentenceKo =
                    if (quizType == QuizType.VOCABULARY) null else "저는 $marker( ) 먹어요.",
                choices =
                    if (quizType == QuizType.VOCABULARY) {
                        listOf(
                            QuizChoiceContent("병원$vocabularyMarker", false, 0),
                            QuizChoiceContent("도서관$vocabularyMarker", true, 1),
                            QuizChoiceContent("학교$vocabularyMarker", false, 2),
                            QuizChoiceContent("시장$vocabularyMarker", false, 3),
                        )
                    } else {
                        listOf(
                            QuizChoiceContent("은-$marker", false, 0),
                            QuizChoiceContent("을-$marker", true, 1),
                            QuizChoiceContent("에-$marker", false, 2),
                            QuizChoiceContent("이-$marker", false, 3),
                        )
                    },
                answerExplanationEn = "Quiz endpoint test: Use 을 for $marker.",
                quizType = quizType,
            )
        val created = commands.createDraft(content, NOW)
        if (approved) {
            commands.approveDraft(created.quizId, NOW.plusSeconds(1))
        }
        return EndpointQuizFixture(created.quizId, content)
    }

    private fun choiceIds(quizId: Long): List<StoredChoice> =
        jdbcClient
            .sql(
                """
                SELECT id, is_correct
                FROM quiz_choices
                WHERE quiz_question_id = :quizId
                ORDER BY sort_order
                """.trimIndent(),
            ).param("quizId", quizId)
            .query { resultSet, _ ->
                StoredChoice(
                    id = resultSet.getLong("id"),
                    correct = resultSet.getBoolean("is_correct"),
                )
            }.list()

    private fun attemptRequest(
        subject: String,
        quizId: Long,
        choiceId: Long,
    ) = post(ATTEMPT_PATH)
        .contentType(MediaType.APPLICATION_JSON)
        .content("""{"quizId":"$quizId","selectedChoiceId":"$choiceId"}""")
        .with(oidcUser(subject))
        .with(csrf())

    private fun oidcUser(subject: String) =
        oidcLogin().idToken { token ->
            token
                .issuer(GOOGLE_ISSUER)
                .subject(subject)
                .claim("email", "learner@example.com")
                .claim("email_verified", true)
        }

    private companion object {
        val NOW: Instant = Instant.parse("2026-07-25T08:00:00Z")
    }
}

private data class TestUser(
    val id: Long,
    val subject: String,
)

private data class EndpointQuizFixture(
    val id: Long,
    val content: QuizContent,
)

private data class StoredChoice(
    val id: Long,
    val correct: Boolean,
)

private const val RECOMMEND_PATH = "/api/v1/quizzes/recommend"
private const val ATTEMPT_PATH = "/api/v1/quizzes/attempt"
