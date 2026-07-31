package io.github.dobbylee.cherryk.presentation.correction

import io.github.dobbylee.cherryk.application.correction.CorrectionApplicationResult
import io.github.dobbylee.cherryk.application.correction.CorrectionApplicationService
import io.github.dobbylee.cherryk.application.correction.CorrectionMistake
import io.github.dobbylee.cherryk.application.correction.CorrectionOutputException
import io.github.dobbylee.cherryk.application.correction.CorrectionRequest
import io.github.dobbylee.cherryk.application.usage.UsageLimitExceededException
import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.presentation.auth.CurrentUserResolver
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import tools.jackson.databind.JsonNode

@RestController
@RequestMapping("/api/v1/corrections")
class CorrectionController(
    private val currentUserResolver: CurrentUserResolver,
    private val correctionService: CorrectionApplicationService,
) {
    @PostMapping(produces = [MediaType.APPLICATION_JSON_VALUE])
    fun correct(
        @AuthenticationPrincipal principal: OidcUser?,
        @RequestBody payload: JsonNode,
    ): CorrectionResponse {
        val authenticatedUser =
            principal
                ?.let {
                    try {
                        currentUserResolver.resolve(it)
                    } catch (exception: RuntimeException) {
                        throw CorrectionAuthenticationUnavailableException(exception)
                    }
                }
                ?: throw CorrectionAuthenticationException()
        val request =
            CorrectionCreateRequest.fromJson(payload)
                ?: throw CorrectionInvalidRequestException()
        val result =
            try {
                correctionService.correct(
                    userId = authenticatedUser.id,
                    request = request.toApplicationRequest(),
                )
            } catch (exception: CorrectionOutputException) {
                throw exception
            } catch (exception: UsageLimitExceededException) {
                throw exception
            } catch (exception: RuntimeException) {
                throw CorrectionUnavailableException(exception)
            }

        return CorrectionResponse.from(result)
    }
}

data class CorrectionCreateRequest(
    val text: String,
    val inputType: String,
    val level: String,
    val correctionStyle: String,
) {
    fun toApplicationRequest() =
        CorrectionRequest(
            text = text,
            inputType = CorrectionInputType.fromDatabase(inputType),
            level = UserLevel.fromDatabase(level),
        )

    companion object {
        fun fromJson(payload: JsonNode): CorrectionCreateRequest? {
            if (!payload.isObject) {
                return null
            }
            val text = payload.textValue("text")?.trim()?.takeIf(String::isNotEmpty) ?: return null
            if (text.length > MAX_CORRECTION_TEXT_LENGTH) {
                return null
            }
            val inputType = payload.textValue("inputType") ?: return null
            if (CorrectionInputType.entries.none { it.databaseValue == inputType }) {
                return null
            }
            val level = payload.textValue("level") ?: return null
            if (UserLevel.entries.none { it.databaseValue == level }) {
                return null
            }
            val correctionStyle = payload.textValue("correctionStyle") ?: return null
            if (correctionStyle != MINIMAL_CORRECTION_STYLE) {
                return null
            }
            return CorrectionCreateRequest(
                text = text,
                inputType = inputType,
                level = level,
                correctionStyle = correctionStyle,
            )
        }
    }
}

data class CorrectionResponse(
    val correctionId: String,
    val originalText: String,
    val correctedText: String,
    val explanationEn: String,
    val mistakes: List<CorrectionMistakeResponse>,
    val recommendedTags: List<String>,
) {
    companion object {
        fun from(result: CorrectionApplicationResult) =
            CorrectionResponse(
                correctionId = result.correctionId.toString(),
                originalText = result.originalText,
                correctedText = result.correctedText,
                explanationEn = result.explanationEn,
                mistakes = result.mistakes.map(CorrectionMistakeResponse::from),
                recommendedTags = result.recommendedTags.map { it.databaseValue },
            )
    }
}

data class CorrectionMistakeResponse(
    val tag: String,
    val originalPart: String,
    val correctedPart: String,
    val explanationEn: String,
    val severity: String,
) {
    companion object {
        fun from(mistake: CorrectionMistake) =
            CorrectionMistakeResponse(
                tag = mistake.tag.databaseValue,
                originalPart = mistake.originalPart,
                correctedPart = mistake.correctedPart,
                explanationEn = mistake.explanationEn,
                severity = mistake.severity.databaseValue,
            )
    }
}

class CorrectionAuthenticationException : RuntimeException("Authentication required.")

class CorrectionInvalidRequestException : RuntimeException("Correction request is invalid.")

class CorrectionAuthenticationUnavailableException(
    cause: Throwable,
) : RuntimeException("Authentication is unavailable.", cause)

class CorrectionUnavailableException(
    cause: Throwable,
) : RuntimeException("Correction is unavailable.", cause)

private fun JsonNode.textValue(fieldName: String): String? =
    get(fieldName)?.takeIf(JsonNode::isString)?.stringValue()

private const val MAX_CORRECTION_TEXT_LENGTH = 4000
private const val MINIMAL_CORRECTION_STYLE = "minimal"
