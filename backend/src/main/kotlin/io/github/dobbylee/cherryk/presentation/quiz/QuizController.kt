package io.github.dobbylee.cherryk.presentation.quiz

import io.github.dobbylee.cherryk.application.quiz.QuizAttemptFailure
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptInput
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptResult
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptService
import io.github.dobbylee.cherryk.application.quiz.QuizAttemptSuccess
import io.github.dobbylee.cherryk.application.quiz.QuizPracticeItem
import io.github.dobbylee.cherryk.application.quiz.QuizProgress
import io.github.dobbylee.cherryk.application.quiz.QuizRecommendation
import io.github.dobbylee.cherryk.application.quiz.QuizRecommendationService
import io.github.dobbylee.cherryk.application.quiz.RecommendedQuiz
import io.github.dobbylee.cherryk.application.quiz.RecommendedQuizChoice
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.presentation.auth.CurrentUserResolver
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.JsonNode

@RestController
@RequestMapping("/api/v1/quizzes")
class QuizController(
    private val currentUserResolver: CurrentUserResolver,
    private val recommendationService: QuizRecommendationService,
    private val attemptService: QuizAttemptService,
) {
    @GetMapping(
        "/recommend",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun recommend(
        @AuthenticationPrincipal principal: OidcUser?,
        @RequestParam(required = false) tags: String?,
    ): QuizRecommendationResponse {
        val userId = authenticatedUserId(principal)
        val parsedTags =
            tags?.let(::parseTags)
                ?: if (tags != null) throw QuizInvalidRequestException(
                    "Quiz recommendation query is invalid.",
                ) else null
        val recommendation =
            try {
                recommendationService.recommend(userId, parsedTags)
            } catch (exception: RuntimeException) {
                throw QuizUnavailableException("Quiz recommendations are unavailable.", exception)
            }
        return QuizRecommendationResponse.from(recommendation)
    }

    @PostMapping(
        "/attempt",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun submitAttempt(
        @AuthenticationPrincipal principal: OidcUser?,
        @RequestBody payload: JsonNode,
    ): QuizAttemptResponse {
        val userId = authenticatedUserId(principal)
        val request =
            QuizAttemptRequest.fromJson(payload)
                ?: throw QuizInvalidRequestException("Quiz attempt request is invalid.")
        val result =
            try {
                attemptService.submit(
                    QuizAttemptInput(
                        userId = userId,
                        quizId = request.quizId,
                        selectedChoiceId = request.selectedChoiceId,
                    ),
                )
            } catch (exception: RuntimeException) {
                throw QuizUnavailableException("Quiz attempt is unavailable.", exception)
            }
        return when (result) {
            is QuizAttemptResult.Success -> QuizAttemptResponse.from(result.value)
            is QuizAttemptResult.Failure -> throw QuizAttemptRejectedException(result.reason)
        }
    }

    private fun authenticatedUserId(principal: OidcUser?): Long {
        val user =
            principal
                ?.let {
                    try {
                        currentUserResolver.resolve(it)
                    } catch (exception: RuntimeException) {
                        throw QuizAuthenticationUnavailableException(exception)
                    }
                }
                ?: throw QuizAuthenticationException()
        return user.id
    }
}

data class QuizAttemptRequest(
    val quizId: Long,
    val selectedChoiceId: Long,
) {
    companion object {
        fun fromJson(payload: JsonNode): QuizAttemptRequest? {
            if (!payload.isObject) {
                return null
            }
            val quizId = payload.textValue("quizId")?.toPositiveLongOrNull() ?: return null
            val selectedChoiceId =
                payload.textValue("selectedChoiceId")?.toPositiveLongOrNull() ?: return null
            return QuizAttemptRequest(quizId, selectedChoiceId)
        }
    }
}

data class QuizRecommendationResponse(
    val quizzes: List<QuizPracticeItemResponse>,
    val availableTags: List<String>,
    val activeTags: List<String>,
    val progress: QuizProgressResponse,
) {
    companion object {
        fun from(recommendation: QuizRecommendation) =
            QuizRecommendationResponse(
                quizzes = recommendation.quizzes.map(QuizPracticeItemResponse::from),
                availableTags = recommendation.availableTags.map(GrammarTag::databaseValue),
                activeTags = recommendation.activeTags.map(GrammarTag::databaseValue),
                progress = QuizProgressResponse.from(recommendation.progress),
            )
    }
}

data class QuizPracticeItemResponse(
    val id: String,
    val tag: String,
    val difficulty: String,
    val questionEn: String,
    val sentenceKo: String,
    val choices: List<RecommendedQuizChoiceResponse>,
    val attemptCount: Int,
) {
    companion object {
        fun from(item: QuizPracticeItem): QuizPracticeItemResponse =
            from(item.quiz, item.attemptCount)

        private fun from(
            quiz: RecommendedQuiz,
            attemptCount: Int,
        ) = QuizPracticeItemResponse(
            id = quiz.id.toString(),
            tag = quiz.tag.databaseValue,
            difficulty = quiz.difficulty.databaseValue,
            questionEn = quiz.questionEn,
            sentenceKo = quiz.sentenceKo,
            choices = quiz.choices.map(RecommendedQuizChoiceResponse::from),
            attemptCount = attemptCount,
        )
    }
}

data class RecommendedQuizChoiceResponse(
    val id: String,
    val text: String,
) {
    companion object {
        fun from(choice: RecommendedQuizChoice) =
            RecommendedQuizChoiceResponse(
                id = choice.id.toString(),
                text = choice.text,
            )
    }
}

data class QuizProgressResponse(
    val solvedCount: Int,
    val totalCount: Int,
    val attemptCount: Int,
    val correctCount: Int,
) {
    companion object {
        fun from(progress: QuizProgress) =
            QuizProgressResponse(
                solvedCount = progress.solvedCount,
                totalCount = progress.totalCount,
                attemptCount = progress.attemptCount,
                correctCount = progress.correctCount,
            )
    }
}

data class QuizAttemptResponse(
    val isCorrect: Boolean,
    val correctChoiceId: String,
    val explanationEn: String,
) {
    companion object {
        fun from(result: QuizAttemptSuccess) =
            QuizAttemptResponse(
                isCorrect = result.correct,
                correctChoiceId = result.correctChoiceId.toString(),
                explanationEn = result.explanationEn,
            )
    }
}

class QuizAuthenticationException : RuntimeException("Authentication required.")

class QuizAuthenticationUnavailableException(
    cause: Throwable,
) : RuntimeException("Authentication is unavailable.", cause)

class QuizInvalidRequestException(
    message: String,
) : RuntimeException(message)

class QuizAttemptRejectedException(
    val reason: QuizAttemptFailure,
) : RuntimeException("Quiz attempt was rejected.")

class QuizUnavailableException(
    val publicMessage: String,
    cause: Throwable,
) : RuntimeException(publicMessage, cause)

private fun parseTags(value: String): List<GrammarTag>? {
    val values =
        value
            .split(",")
            .map(String::trim)
            .filter(String::isNotEmpty)
    if (values.size > GrammarTag.entries.size) {
        return null
    }
    return values.map { GrammarTag.fromDatabaseOrNull(it) ?: return null }
}

private fun JsonNode.textValue(fieldName: String): String? =
    get(fieldName)?.takeIf(JsonNode::isString)?.stringValue()

private fun String.toPositiveLongOrNull(): Long? =
    takeIf { it.matches(POSITIVE_DECIMAL_ID) }
        ?.toLongOrNull()
        ?.takeIf { it > 0 }

private val POSITIVE_DECIMAL_ID = Regex("[1-9]\\d*")
