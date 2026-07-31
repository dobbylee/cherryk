package io.github.dobbylee.cherryk.presentation.auth

import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/auth")
class AuthController(
    private val currentUserResolver: CurrentUserResolver,
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

        val user = currentUserResolver.resolve(principal)

        return MeResponse(
            user =
                user?.let {
                    AuthUserResponse(
                        id = it.id.toString(),
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
    val id: String,
    val displayName: String?,
    val level: String,
)
