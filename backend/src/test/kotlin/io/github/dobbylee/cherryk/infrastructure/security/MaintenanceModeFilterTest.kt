package io.github.dobbylee.cherryk.infrastructure.security

import jakarta.servlet.http.Cookie
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.http.HttpHeaders
import org.springframework.mock.web.MockFilterChain
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import tools.jackson.databind.ObjectMapper
import java.security.MessageDigest
import java.util.Base64

class MaintenanceModeFilterTest {
    private val objectMapper = ObjectMapper()

    @Test
    fun `disabled maintenance mode leaves requests unchanged`() {
        val filter = maintenanceFilter(enabled = false, token = "")
        val request = request("POST", "/api/v1/corrections")
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        filter.doFilter(request, response, chain)

        assertThat(chain.request).isSameAs(request)
    }

    @Test
    fun `write-frozen mode blocks public API requests and complete auth flow`() {
        for (
            request in listOf(
                request("POST", "/api/v1/corrections"),
                request("GET", "/api/v1/quizzes/recommend"),
                request("OPTIONS", "/api/v1/corrections"),
                request("PATCH", "/api/v1/admin/quizzes/1"),
                request("GET", "/api/auth"),
                request("GET", "/api/auth/callback/google"),
            )
        ) {
            val response = MockHttpServletResponse()
            val chain = MockFilterChain()

            maintenanceFilter().doFilter(request, response, chain)

            assertThat(chain.request).isNull()
            assertThat(response.status).isEqualTo(503)
            assertThat(response.getHeader(HttpHeaders.RETRY_AFTER)).isEqualTo("300")
            assertThat(response.getHeader(HttpHeaders.CACHE_CONTROL)).isEqualTo("no-store")
            assertThat(response.contentAsString).contains(
                "\"code\":\"maintenance\"",
                "\"message\":\"CherryK is temporarily read-only.\"",
            )
        }
    }

    @Test
    fun `write-frozen mode allows health and non-API paths`() {
        for (
            request in listOf(
                request("GET", "/actuator/health"),
                request("GET", "/"),
            )
        ) {
            val response = MockHttpServletResponse()
            val chain = MockFilterChain()

            maintenanceFilter().doFilter(request, response, chain)

            assertThat(chain.request).isSameAs(request)
        }
    }

    @Test
    fun `missing or short configured token fails closed`() {
        for (token in listOf("", "too-short")) {
            val request =
                request("POST", "/api/v1/corrections").apply {
                    addHeader(BYPASS_HEADER, token)
                }
            val response = MockHttpServletResponse()

            maintenanceFilter(token = token).doFilter(
                request,
                response,
                MockFilterChain(),
            )

            assertThat(response.status).isEqualTo(503)
        }
    }

    @Test
    fun `operator header bypasses the write block`() {
        val request =
            request("POST", "/api/v1/corrections").apply {
                addHeader(BYPASS_HEADER, BYPASS_TOKEN)
            }
        val response = MockHttpServletResponse()
        val chain = MockFilterChain()

        maintenanceFilter().doFilter(request, response, chain)

        assertThat(chain.request).isSameAs(request)
    }

    @Test
    fun `valid bypass request mints an HttpOnly cookie accepted by later requests`() {
        val accessRequest =
            request("POST", BYPASS_PATH).apply {
                addHeader(BYPASS_HEADER, BYPASS_TOKEN)
            }
        val accessResponse = MockHttpServletResponse()

        maintenanceFilter().doFilter(accessRequest, accessResponse, MockFilterChain())

        assertThat(accessResponse.status).isEqualTo(204)
        assertThat(accessResponse.getHeader(HttpHeaders.SET_COOKIE))
            .contains("CHERRYK_MAINTENANCE_BYPASS=${digest(BYPASS_TOKEN)}")
            .contains("Path=/")
            .contains("Max-Age=28800")
            .contains("HttpOnly")
            .contains("SameSite=Lax")

        val writeRequest =
            request("POST", "/api/v1/corrections").apply {
                setCookies(Cookie(BYPASS_COOKIE, digest(BYPASS_TOKEN)))
            }
        val writeResponse = MockHttpServletResponse()
        val chain = MockFilterChain()

        maintenanceFilter().doFilter(writeRequest, writeResponse, chain)

        assertThat(chain.request).isSameAs(writeRequest)
    }

    @Test
    fun `invalid bypass access is forbidden and delete clears the cookie`() {
        val invalidRequest =
            request("POST", BYPASS_PATH).apply {
                addHeader(BYPASS_HEADER, "invalid-token")
            }
        val invalidResponse = MockHttpServletResponse()
        maintenanceFilter().doFilter(invalidRequest, invalidResponse, MockFilterChain())

        val clearResponse = MockHttpServletResponse()
        maintenanceFilter().doFilter(
            request("DELETE", BYPASS_PATH),
            clearResponse,
            MockFilterChain(),
        )

        assertThat(invalidResponse.status).isEqualTo(403)
        assertThat(clearResponse.status).isEqualTo(204)
        assertThat(clearResponse.getHeader(HttpHeaders.SET_COOKIE))
            .contains("CHERRYK_MAINTENANCE_BYPASS=")
            .contains("Max-Age=0")
    }

    private fun maintenanceFilter(
        enabled: Boolean = true,
        token: String = BYPASS_TOKEN,
    ) = MaintenanceModeFilter(
        objectMapper = objectMapper,
        writeFrozenEnabled = enabled,
        bypassToken = token,
        secureCookies = false,
    )

    private fun request(
        method: String,
        path: String,
    ) = MockHttpServletRequest(method, path)

    private fun digest(value: String): String =
        Base64
            .getUrlEncoder()
            .withoutPadding()
            .encodeToString(
                MessageDigest
                    .getInstance("SHA-256")
                    .digest(value.toByteArray(Charsets.UTF_8)),
            )

    private companion object {
        const val BYPASS_TOKEN = "test-maintenance-token-with-32-characters"
        const val BYPASS_HEADER = "X-CherryK-Maintenance-Bypass"
        const val BYPASS_COOKIE = "CHERRYK_MAINTENANCE_BYPASS"
        const val BYPASS_PATH = "/api/maintenance/bypass"
    }
}
