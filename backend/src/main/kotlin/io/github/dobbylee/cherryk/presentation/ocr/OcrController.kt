package io.github.dobbylee.cherryk.presentation.ocr

import com.fasterxml.jackson.annotation.JsonInclude
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import io.github.dobbylee.cherryk.application.ocr.OcrApplicationException
import io.github.dobbylee.cherryk.application.ocr.OcrApplicationService
import io.github.dobbylee.cherryk.application.ocr.OcrUpload
import io.github.dobbylee.cherryk.application.usage.UsageLimitExceededException
import jakarta.servlet.http.HttpServletRequest
import org.springframework.http.MediaType
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestPart
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile

@RestController
@RequestMapping("/api/v1/ocr")
class OcrController(
    private val identityResolver: OidcIdentityResolver,
    private val ocrService: OcrApplicationService,
) {
    @PostMapping(
        "/extract",
        produces = [MediaType.APPLICATION_JSON_VALUE],
    )
    fun extract(
        @AuthenticationPrincipal principal: OidcUser?,
        request: HttpServletRequest,
        @RequestPart(OCR_IMAGE_FIELD_NAME, required = false) image: MultipartFile?,
    ): OcrExtractResponse {
        if (!request.isMultipartFormData()) {
            throw OcrInvalidRequestException()
        }
        if (image == null) {
            throw OcrApplicationException("invalid_image", "Image file is required.")
        }
        val authenticatedUser =
            principal
                ?.let {
                    val issuer = it.claims["iss"]?.toString().orEmpty()
                    val subject = it.claims["sub"]?.toString().orEmpty()
                    try {
                        identityResolver.findExisting(issuer, subject)
                    } catch (exception: RuntimeException) {
                        throw OcrAuthenticationUnavailableException(exception)
                    }
                }
                ?: throw OcrAuthenticationException()
        val result =
            try {
                ocrService.extract(
                    authenticatedUser.id,
                    OcrUpload(
                        bytes = image.bytes,
                        declaredContentType = image.contentType,
                    ),
                )
            } catch (exception: OcrApplicationException) {
                throw exception
            } catch (exception: UsageLimitExceededException) {
                throw exception
            } catch (exception: RuntimeException) {
                throw OcrUnavailableException(exception)
            }

        return OcrExtractResponse(
            extractedText = result.extractedText,
            note = result.note,
        )
    }
}

@JsonInclude(JsonInclude.Include.NON_NULL)
data class OcrExtractResponse(
    val extractedText: String,
    val note: String? = null,
)

class OcrAuthenticationException : RuntimeException("Authentication required.")

class OcrInvalidRequestException : RuntimeException("Request body must be form data.")

class OcrAuthenticationUnavailableException(
    cause: Throwable,
) : RuntimeException("Authentication is unavailable.", cause)

class OcrUnavailableException(
    cause: Throwable,
) : RuntimeException("OCR is unavailable.", cause)

const val OCR_IMAGE_FIELD_NAME = "image"

private fun HttpServletRequest.isMultipartFormData(): Boolean =
    contentType
        ?.substringBefore(';')
        ?.trim()
        ?.equals(MediaType.MULTIPART_FORM_DATA_VALUE, ignoreCase = true)
        ?: false
