package io.github.dobbylee.cherryk.presentation.auth

import io.github.dobbylee.cherryk.application.auth.ApplicationUserPrincipal
import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.infrastructure.security.ProvisionedOidcUser
import org.junit.jupiter.api.Test
import org.springframework.security.oauth2.core.oidc.OidcIdToken
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.ObjectInputStream
import java.io.ObjectOutputStream
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertIs

class CurrentUserResolverTest {
    private val identityResolver = RecordingIdentityResolver()
    private val resolver = CurrentUserResolver(identityResolver)

    @Test
    fun `uses the provisioned application user without another identity lookup`() {
        val applicationUser = authenticatedUser()
        val principal = ProvisionedOidcUser(applicationUser, oidcUser())

        assertEquals(applicationUser, resolver.resolve(principal))
        assertEquals(0, identityResolver.findExistingCalls)
    }

    @Test
    fun `resolves a generic OIDC principal for test and compatibility contexts`() {
        val applicationUser = authenticatedUser()
        identityResolver.existingUser = applicationUser

        assertEquals(applicationUser, resolver.resolve(oidcUser()))
        assertEquals(1, identityResolver.findExistingCalls)
        assertEquals(GOOGLE_ISSUER, identityResolver.lastIssuer)
        assertEquals(TEST_SUBJECT, identityResolver.lastSubject)
    }

    @Test
    fun `keeps the provisioned application user across session serialization`() {
        val principal = ProvisionedOidcUser(authenticatedUser(), oidcUser())

        val restored =
            ByteArrayOutputStream().use { bytes ->
                ObjectOutputStream(bytes).use { it.writeObject(principal) }
                ObjectInputStream(ByteArrayInputStream(bytes.toByteArray())).use { it.readObject() }
            }

        val applicationPrincipal = assertIs<ApplicationUserPrincipal>(restored)
        assertEquals(authenticatedUser(), applicationPrincipal.applicationUser)
    }

    private fun authenticatedUser() =
        AuthenticatedUser(
            id = 42L,
            displayName = "Cherry",
            level = UserLevel.BEGINNER,
        )

    private fun oidcUser() =
        DefaultOidcUser(
            emptyList(),
            OidcIdToken.withTokenValue("test-token")
                .issuedAt(Instant.parse("2026-01-01T00:00:00Z"))
                .expiresAt(Instant.parse("2026-01-01T01:00:00Z"))
                .issuer(GOOGLE_ISSUER)
                .subject(TEST_SUBJECT)
                .build(),
        )
}

private class RecordingIdentityResolver : OidcIdentityResolver {
    var existingUser: AuthenticatedUser? = null
    var findExistingCalls = 0
    var lastIssuer: String? = null
    var lastSubject: String? = null

    override fun resolveOrCreate(profile: OidcIdentityProfile): AuthenticatedUser =
        error("Not used by this test.")

    override fun findExisting(
        issuer: String,
        subject: String,
    ): AuthenticatedUser? {
        findExistingCalls += 1
        lastIssuer = issuer
        lastSubject = subject
        return existingUser
    }
}

private const val TEST_SUBJECT = "google-subject"
