package io.github.dobbylee.cherryk.application.auth

import io.github.dobbylee.cherryk.PostgreSqlIntegrationTest
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserJpaRepository
import io.github.dobbylee.cherryk.infrastructure.persistence.jpa.UserEntity
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.test.assertEquals

@SpringBootTest
@Transactional
class OidcIdentityIntegrationTest(
    @Autowired private val identityResolver: OidcIdentityResolver,
    @Autowired private val userRepository: UserJpaRepository,
    @Autowired private val jdbcClient: JdbcClient,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `backfilled Google identity resolves to the existing user id`() {
        val subject = "backfilled-${UUID.randomUUID()}"
        val existing =
            userRepository.saveAndFlush(
                UserEntity(
                    displayName = "Existing learner",
                    email = "existing-${UUID.randomUUID()}@example.com",
                ),
            )
        jdbcClient
            .sql(
                """
                INSERT INTO accounts (account_id, provider_id, user_id)
                VALUES (:subject, 'google', :userId)
                """.trimIndent(),
            ).param("subject", subject)
            .param("userId", existing.id)
            .update()
        jdbcClient
            .sql(
                """
                INSERT INTO user_identities (issuer, subject, user_id)
                VALUES (:issuer, :subject, :userId)
                """.trimIndent(),
            ).param("issuer", GOOGLE_ISSUER)
            .param("subject", subject)
            .param("userId", existing.id)
            .update()
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
            jdbcClient
                .sql(
                    """
                    SELECT user_id
                    FROM user_identities
                    WHERE issuer = :issuer
                      AND subject = :subject
                    """.trimIndent(),
                ).param("issuer", GOOGLE_ISSUER)
                .param("subject", subject)
                .query(Long::class.java)
                .single(),
        )
    }
}
