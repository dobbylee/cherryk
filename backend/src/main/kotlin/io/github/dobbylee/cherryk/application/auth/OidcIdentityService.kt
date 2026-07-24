package io.github.dobbylee.cherryk.application.auth

import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant

const val GOOGLE_ISSUER = "https://accounts.google.com"

data class OidcIdentityProfile(
    val issuer: String,
    val subject: String,
    val email: String?,
    val emailVerified: Boolean,
    val displayName: String?,
    val image: String?,
)

data class AuthenticatedUser(
    val id: Long,
    val displayName: String?,
    val level: UserLevel,
)

interface OidcIdentityStore {
    fun findByIdentity(
        issuer: String,
        subject: String,
    ): AuthenticatedUser?

    fun findLegacyGoogleUserId(subject: String): Long?

    fun findUserById(userId: Long): AuthenticatedUser?

    fun findUserIdByEmail(email: String): Long?

    fun createUser(
        profile: OidcIdentityProfile,
        now: Instant,
    ): AuthenticatedUser

    fun refreshUser(
        userId: Long,
        profile: OidcIdentityProfile,
        now: Instant,
    ): AuthenticatedUser

    fun createIdentity(
        issuer: String,
        subject: String,
        userId: Long,
        now: Instant,
    )
}

interface OidcIdentityResolver {
    fun resolveOrCreate(profile: OidcIdentityProfile): AuthenticatedUser

    fun findExisting(
        issuer: String,
        subject: String,
    ): AuthenticatedUser?
}

class OidcIdentityException(
    val code: String,
    message: String,
) : RuntimeException(message)

@Service
class OidcIdentityService(
    private val store: OidcIdentityStore,
    private val clock: Clock,
) : OidcIdentityResolver {
    @Transactional
    override fun resolveOrCreate(profile: OidcIdentityProfile): AuthenticatedUser {
        validate(profile)
        val now = clock.instant()

        store.findByIdentity(profile.issuer, profile.subject)?.let {
            return store.refreshUser(it.id, profile, now)
        }

        val legacyUserId = store.findLegacyGoogleUserId(profile.subject)
        if (legacyUserId != null) {
            val legacyUser =
                store.findUserById(legacyUserId)
                    ?: throw OidcIdentityException(
                        code = "legacy_identity_invalid",
                        message = "The legacy Google account has no application user.",
                    )
            store.createIdentity(profile.issuer, profile.subject, legacyUser.id, now)
            return store.refreshUser(legacyUser.id, profile, now)
        }

        val normalizedEmail = profile.email?.trim()?.lowercase()?.takeIf(String::isNotEmpty)
        if (normalizedEmail != null && store.findUserIdByEmail(normalizedEmail) != null) {
            throw OidcIdentityException(
                code = "identity_link_required",
                message = "An existing account uses this email and requires manual identity linking.",
            )
        }

        val user = store.createUser(profile.copy(email = normalizedEmail), now)
        store.createIdentity(profile.issuer, profile.subject, user.id, now)
        return user
    }

    @Transactional(readOnly = true)
    override fun findExisting(
        issuer: String,
        subject: String,
    ): AuthenticatedUser? {
        if (issuer != GOOGLE_ISSUER || subject.isBlank()) {
            return null
        }
        return store.findByIdentity(issuer, subject)
    }

    private fun validate(profile: OidcIdentityProfile) {
        if (profile.issuer != GOOGLE_ISSUER) {
            throw OidcIdentityException(
                code = "invalid_issuer",
                message = "The OIDC issuer is not supported.",
            )
        }
        if (profile.subject.isBlank()) {
            throw OidcIdentityException(
                code = "invalid_subject",
                message = "The OIDC subject is missing.",
            )
        }
    }
}
