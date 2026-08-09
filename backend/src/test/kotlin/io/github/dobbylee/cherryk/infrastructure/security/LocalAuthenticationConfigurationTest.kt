package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.presentation.auth.AdminAccessController
import io.github.dobbylee.cherryk.presentation.auth.AuthController
import io.github.dobbylee.cherryk.presentation.auth.CurrentUserResolver
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Assertions.assertNotEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.mock.web.MockHttpSession
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(
    controllers = [AuthController::class, AdminAccessController::class],
    properties = [
        "cherryk.security.secure-cookies=false",
        "cherryk.security.local-login-enabled=true",
        "cherryk.security.local-login-email=local@cherryk.invalid",
        "cherryk.security.local-login-display-name=Local Learner",
    ],
)
@Import(
    SecurityConfiguration::class,
    SecurityTestConfiguration::class,
    CurrentUserResolver::class,
)
class LocalAuthenticationConfigurationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `local login persists an authenticated session for learner and admin routes`() {
        val preLoginSession = MockHttpSession()
        preLoginSession.setAttribute("pre-login", "anonymous")

        val session =
            mockMvc
                .perform(get(LocalAuthenticationFilter.LOCAL_LOGIN_PATH).session(preLoginSession))
                .andExpect(status().isFound)
                .andExpect(redirectedUrl("/"))
                .andReturn()
                .request
                .getSession(false) as MockHttpSession

        assertTrue(preLoginSession.isInvalid)
        assertNotEquals(preLoginSession.id, session.id)

        mockMvc
            .perform(get("/api/v1/auth/me").session(session))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.user.id").value(TEST_LOCAL_USER_ID.toString()))
            .andExpect(jsonPath("$.user.displayName").value("Cherry"))
            .andExpect(jsonPath("$.user.level").value("beginner"))

        mockMvc
            .perform(get("/api/v1/admin/access").session(session))
            .andExpect(status().isNoContent)
    }
}

@WebMvcTest(
    controllers = [SecurityProbeController::class],
    properties = [
        "cherryk.security.secure-cookies=true",
        "cherryk.security.local-login-enabled=true",
    ],
)
@Import(SecurityConfiguration::class, SecurityTestConfiguration::class)
class SecureCookieLocalAuthenticationConfigurationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `local login stays unavailable when secure cookies are enabled`() {
        mockMvc
            .perform(get(LocalAuthenticationFilter.LOCAL_LOGIN_PATH))
            .andExpect(status().isNotFound)
    }
}

private const val TEST_LOCAL_USER_ID = 1L
