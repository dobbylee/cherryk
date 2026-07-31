package io.github.dobbylee.cherryk.presentation.auth

import io.github.dobbylee.cherryk.application.auth.ApplicationUserPrincipal
import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.stereotype.Component

@Component
class CurrentUserResolver(
    private val identityResolver: OidcIdentityResolver,
) {
    fun resolve(principal: OidcUser?): AuthenticatedUser? {
        if (principal == null) {
            return null
        }
        if (principal is ApplicationUserPrincipal) {
            return principal.applicationUser
        }

        val issuer = principal.claims["iss"]?.toString().orEmpty()
        val subject = principal.claims["sub"]?.toString().orEmpty()
        return identityResolver.findExisting(issuer, subject)
    }
}
