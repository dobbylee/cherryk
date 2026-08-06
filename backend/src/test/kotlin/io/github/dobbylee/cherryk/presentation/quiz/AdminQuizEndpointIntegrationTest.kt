package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.quiz.QuizCommandResult
import io.github.dobbylee.cherryk.application.quiz.QuizCommandStore
import io.github.dobbylee.cherryk.application.quiz.QuizCommandService
import io.github.dobbylee.cherryk.application.quiz.QuizDraftUpdate
import io.github.dobbylee.cherryk.application.quiz.QuizDraftProvider
import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderException
import io.github.dobbylee.cherryk.application.quiz.QuizDraftProviderInput
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.JpaQuizCommandStore
import org.hamcrest.Matchers.nullValue
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.context.annotation.Primary
import org.springframework.http.MediaType
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import tools.jackson.module.kotlin.jacksonObjectMapper
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

@SpringBootTest(properties = ["cherryk.security.admin-emails=admin@example.com"])
@AutoConfigureMockMvc
@Import(AdminQuizEndpointTestConfiguration::class)
class AdminQuizEndpointIntegrationTest(
    @Autowired private val mockMvc: MockMvc,
    @Autowired private val provider: ControllableQuizDraftProvider,
    @Autowired private val commandStore: ControllableQuizCommandStore,
    @Autowired private val commands: QuizCommandService,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    private val objectMapper = jacksonObjectMapper()

    @BeforeEach
    fun resetProvider() {
        provider.reset()
        commandStore.reset()
    }

    @AfterEach
    fun deleteTestQuizzes() {
        jdbcClient
            .sql(
                """
                SELECT id
                FROM quiz_questions
                WHERE answer_explanation_en LIKE 'Admin endpoint test:%'
                ORDER BY id DESC
                """.trimIndent(),
            ).query(Long::class.java)
            .list()
            .forEach { id ->
                jdbcClient
                    .sql("DELETE FROM quiz_questions WHERE id = :id")
                    .param("id", id)
                    .update()
            }
    }

    @Test
    fun `admin generates persisted drafts with opaque string ids`() {
        val response =
            mockMvc
                .perform(
                    post(GENERATE_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(
                            """
                            {
                              "tag": "particle_object",
                              "difficulty": "beginner",
                              "count": 1.0,
                              "instruction": "  Use food vocabulary.  "
                            }
                            """.trimIndent(),
                        ).with(adminUser())
                        .with(csrf()),
                ).andExpect(status().isOk)
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.drafts[0].id").isString)
                .andExpect(jsonPath("$.drafts[0].tag").value("particle_object"))
                .andExpect(jsonPath("$.drafts[0].difficulty").value("beginner"))
                .andExpect(jsonPath("$.drafts[0].choices.length()").value(4))
                .andExpect(jsonPath("$.drafts[0].choices[1].isCorrect").value(true))
                .andReturn()
                .response

        val draftId =
            objectMapper
                .readTree(response.contentAsString)
                .get("drafts")
                .get(0)
                .get("id")
                .stringValue()
        assertTrue(draftId.all(Char::isDigit))
        assertEquals("Use food vocabulary.", provider.lastInput?.instruction)
        assertEquals(
            StoredQuiz(status = "draft", sentenceKo = provider.result.single().sentenceKo),
            findQuiz(draftId.toLong()),
        )
        assertEquals(4, choiceCount(draftId.toLong()))
        assertEquals(1, provider.callCount)
    }

    @Test
    fun `admin generates vocabulary drafts without a Korean sentence`() {
        provider.result =
            listOf(
                QuizContent(
                    tag = GrammarTag.WORD_CHOICE,
                    difficulty = UserLevel.BEGINNER,
                    questionEn = "A place where people can borrow books.",
                    sentenceKo = null,
                    choices =
                        listOf(
                            QuizChoiceContent("도서관", true, 0),
                            QuizChoiceContent("병원", false, 1),
                            QuizChoiceContent("학교", false, 2),
                            QuizChoiceContent("시장", false, 3),
                        ),
                    answerExplanationEn = "Admin endpoint test: 도서관 means library.",
                    quizType = QuizType.VOCABULARY,
                ),
            )

        mockMvc
            .perform(
                post(GENERATE_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(
                        """
                        {
                          "quizType": "vocabulary",
                          "tag": "word_choice",
                          "difficulty": "beginner",
                          "count": 1
                        }
                        """.trimIndent(),
                    ).with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.drafts[0].quizType").value("vocabulary"))
            .andExpect(jsonPath("$.drafts[0].questionEn").value("A place where people can borrow books."))
            .andExpect(jsonPath("$.drafts[0].sentenceKo").value(nullValue()))
            .andExpect(jsonPath("$.drafts[0].choices[0].text").value("도서관"))

        assertEquals(QuizType.VOCABULARY, provider.lastInput?.quizType)
        assertEquals(GrammarTag.WORD_CHOICE, provider.lastInput?.tag)
    }

    @Test
    fun `admin authentication and CSRF are required before generation`() {
        mockMvc
            .perform(
                post(GENERATE_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validGenerateRequest())
                    .with(csrf()),
            ).andExpect(status().isUnauthorized)
            .andExpect(jsonPath("$.error.code").value("unauthorized"))

        mockMvc
            .perform(
                post(GENERATE_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validGenerateRequest())
                    .with(adminUser(email = "learner@example.com"))
                    .with(csrf()),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("forbidden"))

        mockMvc
            .perform(
                post(GENERATE_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validGenerateRequest())
                    .with(adminUser()),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error.code").value("forbidden"))

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `malformed and invalid admin requests preserve public errors`() {
        mockMvc
            .perform(
                post(GENERATE_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{")
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.message").value("Request body must be JSON."))

        mockMvc
            .perform(
                post(GENERATE_PATH)
                    .contentType(MediaType.TEXT_PLAIN)
                    .content(validGenerateRequest())
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.message").value("Request body must be JSON."))

        listOf(
            """{"tag":"future","difficulty":"beginner","count":1}""",
            """{"tag":"particle_object","difficulty":"advanced","count":1}""",
            """{"tag":"particle_object","difficulty":"beginner","count":"1"}""",
            """{"tag":"particle_object","difficulty":"beginner","count":1.5}""",
            """{"tag":"particle_object","difficulty":"beginner","count":0}""",
            """{"tag":"particle_object","difficulty":"beginner","count":1,"instruction":42}""",
            """{"tag":"particle_object","difficulty":"beginner","count":1,"instruction":"${"x".repeat(1001)}"}""",
            "[]",
        ).forEach { request ->
            mockMvc
                .perform(
                    post(GENERATE_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request)
                        .with(adminUser())
                        .with(csrf()),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error.code").value("invalid_request"))
                .andExpect(jsonPath("$.error.message").value("Quiz draft request is invalid."))
        }

        mockMvc
            .perform(
                patch("$ADMIN_QUIZ_PATH/not-an-id")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"status":"approved"}""")
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error.message").value("Quiz id is invalid."))

        listOf(
            "{}",
            """{"status":"retired"}""",
            """{"questionEn":42}""",
            invalidChoices(),
            """{"choices":[]}""",
        ).forEach { request ->
            mockMvc
                .perform(
                    patch("$ADMIN_QUIZ_PATH/1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(request)
                        .with(adminUser())
                        .with(csrf()),
                ).andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error.message").value("Quiz update request is invalid."))
        }

        assertEquals(0, provider.callCount)
    }

    @Test
    fun `invalid provider output is distinguished while provider details stay hidden`() {
        provider.failure =
            QuizDraftProviderException(
                code = "invalid_response",
                message = "Schema detail.",
            )
        mockMvc
            .perform(generateRequest())
            .andExpect(status().isBadGateway)
            .andExpect(jsonPath("$.error.code").value("invalid_ai_output"))
            .andExpect(jsonPath("$.error.message").value("AI quiz draft output is invalid."))

        provider.failure =
            QuizDraftProviderException(
                code = "timeout",
                message = "Secret timeout detail.",
                retryable = true,
            )
        mockMvc
            .perform(generateRequest())
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.error.code").value("server_error"))
            .andExpect(
                jsonPath("$.error.message")
                    .value("Quiz draft generation is unavailable."),
            )
    }

    @Test
    fun `duplicate generated drafts are skipped`() {
        mockMvc.perform(generateRequest()).andExpect(status().isOk)
        mockMvc
            .perform(generateRequest())
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.drafts.length()").value(0))

        assertEquals(2, provider.callCount)
        assertEquals(
            1,
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM quiz_questions
                    WHERE answer_explanation_en = :explanation
                    """.trimIndent(),
                ).param("explanation", provider.result.single().answerExplanationEn)
                .query(Int::class.java)
                .single(),
        )
    }

    @Test
    fun `nonduplicate failure rolls back every draft in the generated batch`() {
        val marker = UUID.randomUUID().toString()
        provider.result =
            listOf(
                content("batch-first-$marker"),
                content("batch-second-$marker"),
            )
        commandStore.failOnCreateAttempt = 2

        mockMvc
            .perform(generateRequest())
            .andExpect(status().isInternalServerError)
            .andExpect(jsonPath("$.error.code").value("server_error"))

        assertEquals(
            0,
            jdbcClient
                .sql(
                    """
                    SELECT count(*)
                    FROM quiz_questions
                    WHERE answer_explanation_en IN (:first, :second)
                    """.trimIndent(),
                ).param("first", provider.result[0].answerExplanationEn)
                .param("second", provider.result[1].answerExplanationEn)
                .query(Int::class.java)
                .single(),
        )
    }

    @Test
    fun `admin edits and approves a draft in one request then cannot mutate it`() {
        val draftId = generateDraftId()

        mockMvc
            .perform(
                patch("$ADMIN_QUIZ_PATH/$draftId")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(validUpdateRequest(status = "approved"))
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.quiz.id").value(draftId.toString()))
            .andExpect(jsonPath("$.quiz.status").value("approved"))

        assertEquals(
            StoredQuiz(status = "approved", sentenceKo = "저는 빵( ) 먹어요."),
            findQuiz(draftId),
        )
        assertEquals(
            listOf("은", "을", "에", "이"),
            choiceTexts(draftId),
        )

        mockMvc
            .perform(
                patch("$ADMIN_QUIZ_PATH/$draftId")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"sentenceKo":"바뀌면 안 돼요."}""")
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error.code").value("quiz_not_editable"))

        mockMvc
            .perform(
                delete("$ADMIN_QUIZ_PATH/$draftId")
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error.code").value("quiz_not_found"))
    }

    @Test
    fun `admin rejects and deletes only a draft`() {
        val draftId = generateDraftId()

        mockMvc
            .perform(
                delete("$ADMIN_QUIZ_PATH/$draftId")
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.deletedQuizId").value(draftId.toString()))

        assertEquals(0, quizCount(draftId))
    }

    @Test
    fun `failed edit and approval rolls back both changes and retirement`() {
        val originalContent = content("original-${UUID.randomUUID()}")
        val duplicateContent = content("duplicate-${UUID.randomUUID()}")
        val original = commands.createDraft(originalContent, NOW)
        commands.approveDraft(original.quizId, NOW.plusSeconds(1))
        val duplicate = commands.createDraft(duplicateContent, NOW.plusSeconds(2))
        commands.approveDraft(duplicate.quizId, NOW.plusSeconds(3))
        val revision =
            assertIs<QuizCommandResult.Success>(
                commands.createRevision(original.quizId, NOW.plusSeconds(4)),
            )

        mockMvc
            .perform(
                patch("$ADMIN_QUIZ_PATH/${revision.quizId}")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(updateRequestFor(duplicateContent, status = "approved"))
                    .with(adminUser())
                    .with(csrf()),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error.code").value("quiz_duplicate"))

        assertEquals("approved", findQuiz(original.quizId).status)
        assertEquals("draft", findQuiz(revision.quizId).status)
        assertEquals(originalContent.sentenceKo, findQuiz(revision.quizId).sentenceKo)
    }

    private fun generateDraftId(): Long {
        val response =
            mockMvc
                .perform(generateRequest())
                .andExpect(status().isOk)
                .andReturn()
                .response
        return objectMapper
            .readTree(response.contentAsString)
            .get("drafts")
            .get(0)
            .get("id")
            .stringValue()
            .toLong()
    }

    private fun generateRequest() =
        post(GENERATE_PATH)
            .contentType(MediaType.APPLICATION_JSON)
            .content(validGenerateRequest())
            .with(adminUser())
            .with(csrf())

    private fun adminUser(email: String = "admin@example.com") =
        oidcLogin().idToken { token ->
            token
                .issuer(GOOGLE_ISSUER)
                .subject("admin-subject")
                .claim("email", email)
                .claim("email_verified", true)
        }

    private fun validGenerateRequest() =
        """
        {
          "tag": "particle_object",
          "difficulty": "beginner",
          "count": 1
        }
        """.trimIndent()

    private fun validUpdateRequest(status: String? = null) =
        """
        {
          "tag": "particle_object",
          "difficulty": "beginner",
          "questionEn": "Choose the correct particle.",
          "sentenceKo": "저는 빵( ) 먹어요.",
          "choices": [
            {"text":"은","isCorrect":false,"sortOrder":0.0},
            {"text":"을","isCorrect":true,"sortOrder":1},
            {"text":"에","isCorrect":false,"sortOrder":2},
            {"text":"이","isCorrect":false,"sortOrder":3}
          ],
          "answerExplanationEn": "Admin endpoint test: Use 을."
          ${status?.let { ""","status":"$it"""" } ?: ""}
        }
        """.trimIndent()

    private fun invalidChoices() =
        """
        {
          "choices": [
            {"text":"은","isCorrect":false,"sortOrder":0},
            {"text":"을","isCorrect":true,"sortOrder":1},
            {"text":"에","isCorrect":true,"sortOrder":2},
            {"text":"이","isCorrect":false,"sortOrder":3}
          ]
        }
        """.trimIndent()

    private fun updateRequestFor(
        content: QuizContent,
        status: String,
    ) =
        objectMapper.writeValueAsString(
            mapOf(
                "tag" to content.tag.databaseValue,
                "difficulty" to content.difficulty.databaseValue,
                "questionEn" to content.questionEn,
                "sentenceKo" to content.sentenceKo,
                "choices" to
                    content.choices.map { choice ->
                        mapOf(
                            "text" to choice.text,
                            "isCorrect" to choice.correct,
                            "sortOrder" to choice.sortOrder,
                        )
                    },
                "answerExplanationEn" to content.answerExplanationEn,
                "status" to status,
            ),
        )

    private fun findQuiz(id: Long): StoredQuiz =
        jdbcClient
            .sql("SELECT status, sentence_ko FROM quiz_questions WHERE id = :id")
            .param("id", id)
            .query { resultSet, _ ->
                StoredQuiz(
                    status = resultSet.getString("status"),
                    sentenceKo = resultSet.getString("sentence_ko"),
                )
            }.single()

    private fun choiceCount(id: Long): Int =
        jdbcClient
            .sql("SELECT count(*) FROM quiz_choices WHERE quiz_question_id = :id")
            .param("id", id)
            .query(Int::class.java)
            .single()

    private fun choiceTexts(id: Long): List<String> =
        jdbcClient
            .sql(
                """
                SELECT choice_text
                FROM quiz_choices
                WHERE quiz_question_id = :id
                ORDER BY sort_order
                """.trimIndent(),
            ).param("id", id)
            .query(String::class.java)
            .list()
            .filterNotNull()

    private fun quizCount(id: Long): Int =
        jdbcClient
            .sql("SELECT count(*) FROM quiz_questions WHERE id = :id")
            .param("id", id)
            .query(Int::class.java)
            .single()

    private fun content(marker: String) =
        QuizContent(
            tag = GrammarTag.PARTICLE_OBJECT,
            difficulty = UserLevel.BEGINNER,
            questionEn = "Admin endpoint question.",
            sentenceKo = "저는 $marker( ) 먹어요.",
            choices =
                listOf(
                    QuizChoiceContent("은-$marker", false, 0),
                    QuizChoiceContent("을-$marker", true, 1),
                    QuizChoiceContent("에-$marker", false, 2),
                    QuizChoiceContent("이-$marker", false, 3),
                ),
            answerExplanationEn = "Admin endpoint test: $marker",
        )

    private companion object {
        val NOW: Instant = Instant.parse("2026-07-25T06:00:00Z")
    }
}

@TestConfiguration(proxyBeanMethods = false)
class AdminQuizEndpointTestConfiguration {
    @Bean
    @Primary
    fun controllableQuizDraftProvider() = ControllableQuizDraftProvider()

    @Bean
    @Primary
    fun controllableQuizCommandStore(delegate: JpaQuizCommandStore) =
        ControllableQuizCommandStore(delegate)
}

class ControllableQuizCommandStore(
    private val delegate: QuizCommandStore,
) : QuizCommandStore {
    var failOnCreateAttempt: Int? = null
    private var createAttempt = 0

    override fun createDraft(
        content: QuizContent,
        now: Instant,
    ) = delegate.createDraft(content, now)

    override fun createDraftIfAbsent(
        content: QuizContent,
        now: Instant,
    ): QuizCommandResult.Success? {
        createAttempt += 1
        if (createAttempt == failOnCreateAttempt) {
            throw IllegalStateException("Injected nonduplicate batch failure.")
        }
        return delegate.createDraftIfAbsent(content, now)
    }

    override fun prepareDraftBatch(contents: List<QuizContent>) =
        delegate.prepareDraftBatch(contents)

    override fun createRevision(
        approvedQuizId: Long,
        now: Instant,
    ) = delegate.createRevision(approvedQuizId, now)

    override fun updateDraft(
        quizId: Long,
        update: QuizDraftUpdate,
        now: Instant,
    ) = delegate.updateDraft(quizId, update, now)

    override fun approveDraft(
        quizId: Long,
        now: Instant,
    ) = delegate.approveDraft(quizId, now)

    override fun confirmDraft(quizId: Long) = delegate.confirmDraft(quizId)

    override fun rejectDraft(quizId: Long) = delegate.rejectDraft(quizId)

    fun reset() {
        failOnCreateAttempt = null
        createAttempt = 0
    }
}

class ControllableQuizDraftProvider : QuizDraftProvider {
    var result: List<QuizContent> = emptyList()
    var failure: RuntimeException? = null
    var callCount = 0
        private set
    var lastInput: QuizDraftProviderInput? = null
        private set

    override fun generate(input: QuizDraftProviderInput): List<QuizContent> {
        callCount += 1
        lastInput = input
        failure?.let { throw it }
        return result
    }

    fun reset() {
        val marker = UUID.randomUUID().toString()
        result =
            listOf(
                QuizContent(
                    tag = GrammarTag.PARTICLE_OBJECT,
                    difficulty = UserLevel.BEGINNER,
                    questionEn = "Choose the correct particle.",
                    sentenceKo = "저는 사과($marker) 먹어요.",
                    choices =
                        listOf(
                            QuizChoiceContent("은", false, 0),
                            QuizChoiceContent("를", true, 1),
                            QuizChoiceContent("에", false, 2),
                            QuizChoiceContent("이", false, 3),
                        ),
                    answerExplanationEn = "Admin endpoint test: $marker",
                ),
            )
        failure = null
        callCount = 0
        lastInput = null
    }
}

private data class StoredQuiz(
    val status: String,
    val sentenceKo: String?,
)

private const val ADMIN_QUIZ_PATH = "/api/v1/admin/quizzes"
private const val GENERATE_PATH = "$ADMIN_QUIZ_PATH/generate-drafts"
