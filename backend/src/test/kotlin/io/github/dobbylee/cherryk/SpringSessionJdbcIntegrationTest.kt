package io.github.dobbylee.cherryk

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.session.Session
import org.springframework.session.SessionRepository
import org.springframework.session.jdbc.JdbcIndexedSessionRepository
import java.time.Duration
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

@SpringBootTest
class SpringSessionJdbcIntegrationTest(
    @Autowired private val sessionRepository: JdbcIndexedSessionRepository,
    @Autowired private val jdbcClient: JdbcClient,
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
}
