package io.github.dobbylee.cherryk.application.auth

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserJpaRepository
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserEntity
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class OidcIdentityIntegrationTest(
    @Autowired private val identityResolver: OidcIdentityResolver,
    @Autowired private val identityStore: OidcIdentityStore,
    @Autowired private val userRepository: UserJpaRepository,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `existing Google identity resolves to the existing user id`() {
        val subject = "backfilled-${UUID.randomUUID()}"
        val existing =
            userRepository.saveAndFlush(
                UserEntity(
                    displayName = "Existing learner",
                    email = "existing-${UUID.randomUUID()}@example.com",
                ),
            )
        identityStore.createIdentity(
            issuer = GOOGLE_ISSUER,
            subject = subject,
            userId = existing.id,
            now = Instant.parse("2026-08-07T00:00:00Z"),
        )
        val userCountBefore = userRepository.count()

        val resolved =
            identityResolver.resolveOrCreate(
                OidcIdentityProfile(
                    issuer = GOOGLE_ISSUER,
                    subject = subject,
                    email = existing.email,
                    emailVerified = true,
                    displayName = "Updated learner",
                    image = null,
                ),
            )

        assertEquals(existing.id, resolved.id)
        assertEquals(userCountBefore, userRepository.count())
        assertEquals(
            existing.id,
            identityResolver.findExisting(GOOGLE_ISSUER, subject)?.id,
        )
    }
}
