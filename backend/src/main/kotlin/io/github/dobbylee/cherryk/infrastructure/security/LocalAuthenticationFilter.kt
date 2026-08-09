package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.oidc.OidcIdToken
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser
import org.springframework.security.web.context.HttpSessionSecurityContextRepository
import org.springframework.web.filter.OncePerRequestFilter
import java.time.Clock
import java.time.temporal.ChronoUnit

class LocalAuthenticationFilter(
    private val enabled: Boolean,
    private val identityResolver: OidcIdentityResolver,
    private val email: String,
    private val displayName: String,
    private val clock: Clock = Clock.systemUTC(),
) : OncePerRequestFilter() {
    private val securityContextRepository = HttpSessionSecurityContextRepository()

    override fun shouldNotFilter(request: HttpServletRequest): Boolean =
        request.method != "GET" || request.requestURI != LOCAL_LOGIN_PATH

    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (!enabled) {
            response.sendError(HttpStatus.NOT_FOUND.value())
            return
        }

        val applicationUser =
            identityResolver.resolveOrCreate(
                OidcIdentityProfile(
                    issuer = GOOGLE_ISSUER,
                    subject = LOCAL_SUBJECT,
                    email = email,
                    emailVerified = true,
                    displayName = displayName,
                    image = null,
                ),
            )
        val issuedAt = clock.instant()
        val idToken =
            OidcIdToken(
                LOCAL_ID_TOKEN,
                issuedAt,
                issuedAt.plus(1, ChronoUnit.DAYS),
                mapOf(
                    "iss" to GOOGLE_ISSUER,
                    "sub" to LOCAL_SUBJECT,
                    "email" to email,
                    "email_verified" to true,
                    "name" to displayName,
                ),
            )
        val oidcUser = DefaultOidcUser(emptyList(), idToken, "sub")
        val principal = ProvisionedOidcUser(applicationUser, oidcUser)
        val authentication =
            OAuth2AuthenticationToken(
                principal,
                principal.authorities,
                LOCAL_REGISTRATION_ID,
            )

        request.getSession(false)?.invalidate()
        val context = SecurityContextHolder.createEmptyContext()
        context.authentication = authentication
        SecurityContextHolder.setContext(context)
        securityContextRepository.saveContext(context, request, response)
        response.sendRedirect("/")
    }

    companion object {
        const val LOCAL_LOGIN_PATH = "/api/auth/login/local"
        const val LOCAL_REGISTRATION_ID = "local"
        private const val LOCAL_SUBJECT = "cherryk-local-development"
        private const val LOCAL_ID_TOKEN = "cherryk-local-development-token"
    }
}
