package io.github.dobbylee.cherryk.presentation.auth

import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val identityResolver: OidcIdentityResolver,
) {
    @GetMapping("/me")
    fun me(
        @AuthenticationPrincipal principal: OidcUser?,
        csrfToken: CsrfToken,
    ): MeResponse {
        check(csrfToken.token.isNotEmpty())
        if (principal == null) {
            return MeResponse(user = null)
        }

        val issuer = principal.claims["iss"]?.toString().orEmpty()
        val subject = principal.claims["sub"]?.toString().orEmpty()
        val user = identityResolver.findExisting(issuer, subject)

        return MeResponse(
            user =
                user?.let {
                    AuthUserResponse(
                        id = it.id,
                        displayName = it.displayName,
                        level = it.level.databaseValue,
                    )
                },
        )
    }
}

data class MeResponse(
    val user: AuthUserResponse?,
)

data class AuthUserResponse(
    val id: UUID,
    val displayName: String?,
    val level: String,
)
