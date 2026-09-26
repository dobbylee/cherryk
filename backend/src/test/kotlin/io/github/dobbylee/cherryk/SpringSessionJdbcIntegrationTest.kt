package io.github.dobbylee.cherryk

import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.presentation.auth.CurrentUserResolver
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.io.ClassPathResource
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.context.SecurityContext
import org.springframework.security.oauth2.client.authentication.OAuth2AuthenticationToken
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.session.Session
import org.springframework.session.SessionRepository
import org.springframework.session.jdbc.JdbcIndexedSessionRepository
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertIs

@SpringBootTest
class SpringSessionJdbcIntegrationTest(
    @Autowired private val sessionRepository: JdbcIndexedSessionRepository,
    @Autowired private val jdbcClient: JdbcClient,
    @Autowired private val currentUserResolver: CurrentUserResolver,
) : PostgreSqlIntegrationTest() {
    @Test
    fun `session survives a fresh database read`() {
        @Suppress("UNCHECKED_CAST")
        val repository = sessionRepository as SessionRepository<Session>
        val session = repository.createSession()
        assertEquals(Duration.ofDays(90), session.maxInactiveInterval)
        session.setAttribute("applicationUserId", "10000000-0000-4000-8000-000000000001")
        repository.save(session)

        try {
            val restored = assertNotNull(repository.findById(session.id))
            assertEquals(
                "10000000-0000-4000-8000-000000000001",
                restored.getAttribute("applicationUserId"),
            )
            assertEquals(
                1,
                jdbcClient
                    .sql("SELECT count(*) FROM spring_session WHERE session_id = :sessionId")
                    .param("sessionId", session.id)
                    .query(Int::class.java)
                    .single(),
            )
        } finally {
            repository.deleteById(session.id)
        }
    }

    @Test
    fun `restores a previously serialized OIDC principal from JDBC session bytes`() {
        @Suppress("UNCHECKED_CAST")
        val repository = sessionRepository as SessionRepository<Session>
        val session = repository.createSession()
        session.setAttribute(PLACEHOLDER_ATTRIBUTE, "placeholder")
        repository.save(session)

        try {
            val historicalBytes =
                ClassPathResource("session-fixtures/security-context-bed7bf3.bin")
                    .inputStream.use { it.readBytes() }
            val updated =
                jdbcClient
                    .sql(
                        """
                        UPDATE spring_session_attributes
                        SET attribute_name = :securityContextName,
                            attribute_bytes = :bytes
                        WHERE session_primary_id = (
                            SELECT primary_id FROM spring_session WHERE session_id = :sessionId
                        ) AND attribute_name = :placeholderName
                        """.trimIndent(),
                    ).param("bytes", historicalBytes)
                    .param("sessionId", session.id)
                    .param("securityContextName", SECURITY_CONTEXT_ATTRIBUTE)
                    .param("placeholderName", PLACEHOLDER_ATTRIBUTE)
                    .update()
            assertEquals(1, updated)

            val restored = assertNotNull(repository.findById(session.id))
            val context = assertIs<SecurityContext>(restored.getAttribute<Any>(SECURITY_CONTEXT_ATTRIBUTE))
            val authentication = assertIs<OAuth2AuthenticationToken>(context.authentication)
            val principal = assertIs<OidcUser>(authentication.principal)
            assertEquals("google", authentication.authorizedClientRegistrationId)
            assertEquals(
                AuthenticatedUser(42L, "Synthetic learner", UserLevel.LOWER_INTERMEDIATE),
                currentUserResolver.resolve(principal),
            )
        } finally {
            repository.deleteById(session.id)
        }
    }
}

private const val SECURITY_CONTEXT_ATTRIBUTE = "SPRING_SECURITY_CONTEXT"
private const val PLACEHOLDER_ATTRIBUTE = "compatibility-placeholder"
