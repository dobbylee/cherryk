package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityStore
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant

@Repository
class JpaOidcIdentityStore(
    private val userRepository: UserJpaRepository,
    private val identityRepository: UserIdentityJpaRepository,
    private val jdbcClient: JdbcClient,
) : OidcIdentityStore {
    override fun findByIdentity(
        issuer: String,
        subject: String,
    ): AuthenticatedUser? {
        val identity = identityRepository.findByIssuerAndSubject(issuer, subject) ?: return null
        return userRepository.findById(identity.userId).orElse(null)?.toAuthenticatedUser()
    }

    override fun findLegacyGoogleUserId(subject: String): Long? =
        jdbcClient
            .sql(
                """
                SELECT user_id
                FROM accounts
                WHERE provider_id = 'google'
                  AND account_id = :subject
                """.trimIndent(),
            ).param("subject", subject)
            .query(Long::class.java)
            .optional()
            .orElse(null)

    override fun findUserById(userId: Long): AuthenticatedUser? =
        userRepository.findById(userId).orElse(null)?.toAuthenticatedUser()

    override fun findUserIdByEmail(email: String): Long? =
        userRepository.findFirstByEmailIgnoreCase(email)?.id

    override fun createUser(
        profile: OidcIdentityProfile,
        now: Instant,
    ): AuthenticatedUser =
        userRepository
            .save(
                UserEntity(
                    displayName = profile.displayName,
                    email = profile.email,
                    emailVerified = profile.emailVerified,
                    image = profile.image,
                    createdAt = now,
                    updatedAt = now,
                    lastSeenAt = now,
                ),
            ).toAuthenticatedUser()

    override fun refreshUser(
        userId: Long,
        profile: OidcIdentityProfile,
        now: Instant,
    ): AuthenticatedUser {
        val user = userRepository.findById(userId).orElseThrow()
        val normalizedEmail = profile.email?.trim()?.lowercase()?.takeIf(String::isNotEmpty)
        val emailOwnerId = normalizedEmail?.let(::findUserIdByEmail)
        val canUpdateEmail = emailOwnerId == null || emailOwnerId == userId

        user.refreshOidcProfile(
            displayName = profile.displayName,
            email = normalizedEmail.takeIf { canUpdateEmail },
            emailVerified = profile.emailVerified,
            image = profile.image,
            now = now,
        )
        return user.toAuthenticatedUser()
    }

    override fun createIdentity(
        issuer: String,
        subject: String,
        userId: Long,
        now: Instant,
    ) {
        identityRepository.save(
            UserIdentityEntity(
                issuer = issuer,
                subject = subject,
                userId = userId,
                createdAt = now,
            ),
        )
    }

    private fun UserEntity.toAuthenticatedUser() =
        AuthenticatedUser(
            id = id,
            displayName = displayName,
            level = level,
        )
}
