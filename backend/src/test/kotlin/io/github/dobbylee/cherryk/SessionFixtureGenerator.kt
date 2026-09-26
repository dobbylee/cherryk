package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.infrastructure.security.ProvisionedOidcUser
import org.springframework.security.core.context.SecurityContextImpl
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.oidc.OidcIdToken
import org.springframework.security.oauth2.core.oidc.user.DefaultOidcUser
import java.io.ByteArrayOutputStream
import java.io.ObjectOutputStream
import java.nio.file.Files
import java.nio.file.Path
import java.time.Instant

/** Run only from the phase-1 baseline to reproduce the committed compatibility bytes. */
object SessionFixtureGenerator {
    @JvmStatic
    fun main(args: Array<String>) {
        require(args.size == 1) { "Expected one output path." }
        val oidcUser =
            DefaultOidcUser(
                emptyList(),
                OidcIdToken.withTokenValue("synthetic-token")
                    .issuedAt(Instant.parse("2026-01-01T00:00:00Z"))
                    .expiresAt(Instant.parse("2026-01-01T01:00:00Z"))
                    .issuer(GOOGLE_ISSUER)
                    .subject("synthetic-session-subject")
                    .build(),
            )
        val principal =
            ProvisionedOidcUser(
                AuthenticatedUser(42L, "Synthetic learner", UserLevel.LOWER_INTERMEDIATE),
                oidcUser,
            )
        val context =
            SecurityContextImpl().apply {
                authentication = OAuth2AuthenticationToken(principal, emptyList(), "google")
            }
        val bytes =
            ByteArrayOutputStream().use { output ->
                ObjectOutputStream(output).use { it.writeObject(context) }
                output.toByteArray()
            }
        val outputPath = Path.of(args.single())
        Files.createDirectories(outputPath.parent)
        Files.write(outputPath, bytes)
    }
}
