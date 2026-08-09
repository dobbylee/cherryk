package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import org.springframework.beans.factory.annotation.Value
import org.springframework.security.authorization.AuthorizationDecision
import org.springframework.security.authorization.AuthorizationManager
import org.springframework.security.authorization.AuthorizationResult
import org.springframework.security.core.Authentication
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.security.web.access.intercept.RequestAuthorizationContext
import org.springframework.stereotype.Component
import java.util.function.Supplier

@Component
class AdminAuthorizationManager(
    @Value("\${cherryk.security.admin-emails:}")
    adminEmails: String,
    @Value("\${cherryk.security.local-login-enabled:false}")
    localLoginEnabled: Boolean = false,
    @Value("\${cherryk.security.secure-cookies:true}")
    secureCookies: Boolean = true,
) : AuthorizationManager<RequestAuthorizationContext> {
    private val localLoginEnabled = localLoginEnabled && !secureCookies
    private val allowedEmails =
        adminEmails
            .split(",")
            .map(String::trim)
            .map(String::lowercase)
            .filter(String::isNotEmpty)
            .toSet()

    override fun authorize(
        authentication: Supplier<out Authentication>,
        context: RequestAuthorizationContext,
    ): AuthorizationResult {
        val resolvedAuthentication = authentication.get()
        if (
            localLoginEnabled &&
            resolvedAuthentication is OAuth2AuthenticationToken &&
            resolvedAuthentication.authorizedClientRegistrationId ==
            LocalAuthenticationFilter.LOCAL_REGISTRATION_ID
        ) {
            return AuthorizationDecision(true)
        }

        val principal = resolvedAuthentication.principal as? OidcUser
        val email = (principal?.claims?.get("email") as? String)?.trim()?.lowercase()
        val isVerified = principal?.claims?.get("email_verified") == true
        val issuer = principal?.claims?.get("iss")?.toString()

        return AuthorizationDecision(
            issuer == GOOGLE_ISSUER &&
                isVerified &&
                email != null &&
                email in allowedEmails,
        )
    }
}
