package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.junit.jupiter.api.Test
import org.springframework.core.io.ClassPathResource
import tools.jackson.databind.JsonNode
import tools.jackson.module.kotlin.jacksonObjectMapper
import kotlin.test.assertEquals
import kotlin.test.assertNull

class QuizContractTest {
    private val objectMapper = jacksonObjectMapper()
    private val fixtures =
        ClassPathResource("api-v1.json").inputStream.use(objectMapper::readTree)

    @Test
    fun `quiz recommendation query accepts the shared TypeScript contract fixture`() {
        val tags =
            fixtures
                .get("quizRecommendationQuery")
                .get("tags")
                .joinToString(",") { it.stringValue() }

        assertEquals(
            listOf(GrammarTag.PARTICLE_LOCATION),
            parseQuizRecommendationTags(tags),
        )
    }

    @Test
    fun `quiz attempt request accepts the shared TypeScript contract fixture`() {
        assertEquals(
            QuizAttemptRequest(quizId = 3001L, selectedChoiceId = 4002L),
            QuizAttemptRequest.fromJson(fixtures.get("quizAttemptRequest")),
        )
    }

    @Test
    fun `quiz recommendation response matches the shared TypeScript contract fixture`() {
        val actual: JsonNode =
            objectMapper.valueToTree(
                QuizRecommendationResponse(
                    quizzes =
                        listOf(
                            QuizPracticeItemResponse(
                                id = "3001",
                                quizType = "grammar",
                                tag = "particle_location",
                                difficulty = "beginner",
                                questionEn = "Choose the particle for where an action happens.",
                                sentenceKo = "저는 도서관( ) 공부해요.",
                                choices =
                                    listOf(
                                        RecommendedQuizChoiceResponse("4001", "에"),
                                        RecommendedQuizChoiceResponse("4002", "에서"),
                                        RecommendedQuizChoiceResponse("4003", "을"),
                                        RecommendedQuizChoiceResponse("4004", "는"),
                                    ),
                                attemptCount = 0,
                            ),
                        ),
                    availableTags = listOf("particle_location"),
                    activeTags = listOf("particle_location"),
                    progress =
                        QuizProgressResponse(
                            solvedCount = 0,
                            totalCount = 1,
                            attemptCount = 0,
                            correctCount = 0,
                        ),
                ),
            )

        assertEquals(fixtures.get("quizRecommendationResponse"), actual)
    }

    @Test
    fun `quiz attempt response matches the shared TypeScript contract fixture`() {
        val actual: JsonNode =
            objectMapper.valueToTree(
                QuizAttemptResponse(
                    isCorrect = true,
                    correctChoiceId = "4002",
                    explanationEn = "Use 에서 for the place where an action happens.",
                ),
            )

        assertEquals(fixtures.get("quizAttemptResponse"), actual)
    }

    @Test
    fun `admin draft request accepts the shared TypeScript contract fixture`() {
        assertEquals(
            AdminQuizDraftCreateRequest(
                quizType = QuizType.GRAMMAR,
                tag = GrammarTag.PARTICLE_LOCATION,
                difficulty = UserLevel.BEGINNER,
                count = 1,
                instruction = "Use a daily routine.",
            ),
            AdminQuizDraftCreateRequest.fromJson(fixtures.get("adminQuizDraftRequest")),
        )
    }

    @Test
    fun `admin draft response matches the shared TypeScript contract fixture`() {
        val actual: JsonNode =
            objectMapper.valueToTree(
                AdminQuizDraftGenerationResponse(
                    drafts =
                        listOf(
                            AdminQuizDraftResponse(
                                id = "3001",
                                quizType = "grammar",
                                tag = "particle_location",
                                difficulty = "beginner",
                                questionEn = "Choose the particle for where an action happens.",
                                sentenceKo = "저는 도서관( ) 공부해요.",
                                choices =
                                    listOf(
                                        AdminQuizDraftChoiceResponse("에", false),
                                        AdminQuizDraftChoiceResponse("에서", true),
                                        AdminQuizDraftChoiceResponse("을", false),
                                        AdminQuizDraftChoiceResponse("는", false),
                                    ),
                                answerExplanationEn =
                                    "Use 에서 for the place where an action happens.",
                            ),
                        ),
                ),
            )

        assertEquals(fixtures.get("adminQuizDraftResponse"), actual)
    }

    @Test
    fun `admin update request accepts the shared TypeScript contract fixture`() {
        assertEquals(
            AdminQuizUpdateRequest(
                tag = null,
                difficulty = null,
                questionEn = null,
                sentenceKo = null,
                choices = null,
                answerExplanationEn = null,
                status = QuizStatus.APPROVED,
            ),
            AdminQuizUpdateRequest.fromJson(fixtures.get("adminQuizUpdateRequest")),
        )
    }

    @Test
    fun `admin update request rejects unknown choice fields`() {
        listOf(
            """"id":"4001",""",
            """"legacyId":"4001",""",
        ).forEach { unknownField ->
            val payload =
                objectMapper.readTree(
                    """
                    {
                      "choices": [
                        {$unknownField"text":"에","isCorrect":false,"sortOrder":0},
                        {"text":"에서","isCorrect":true,"sortOrder":1},
                        {"text":"을","isCorrect":false,"sortOrder":2},
                        {"text":"는","isCorrect":false,"sortOrder":3}
                      ]
                    }
                    """.trimIndent(),
                )

            assertNull(AdminQuizUpdateRequest.fromJson(payload))
        }
    }

    @Test
    fun `admin update and delete responses match the shared TypeScript contract fixtures`() {
        val update: JsonNode =
            objectMapper.valueToTree(
                AdminQuizUpdateResponse(
                    quiz = AdminQuizStatusResponse(id = "3001", status = "approved"),
                ),
            )
        val delete: JsonNode =
            objectMapper.valueToTree(AdminQuizDeleteResponse(deletedQuizId = "3001"))

        assertEquals(fixtures.get("adminQuizUpdateResponse"), update)
        assertEquals(fixtures.get("adminQuizDeleteResponse"), delete)
    }
}
