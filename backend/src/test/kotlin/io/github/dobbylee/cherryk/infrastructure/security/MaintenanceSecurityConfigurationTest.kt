package io.github.dobbylee.cherryk.infrastructure.security

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

@WebMvcTest(
    controllers = [SecurityProbeController::class],
    properties = [
        "cherryk.security.secure-cookies=false",
        "cherryk.maintenance.mode=write-frozen",
        "cherryk.maintenance.bypass-token=test-maintenance-token-with-32-characters",
    ],
)
@Import(SecurityConfiguration::class, SecurityTestConfiguration::class)
class MaintenanceSecurityConfigurationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `security chain blocks public application and auth APIs before authentication`() {
        mockMvc
            .perform(post("/api/v1/corrections"))
            .andExpect(status().isServiceUnavailable)
            .andExpect(header().string("Retry-After", "300"))
            .andExpect(jsonPath("$.error.code").value("maintenance"))

        mockMvc
            .perform(get("/api/auth/callback/google"))
            .andExpect(status().isServiceUnavailable)
            .andExpect(jsonPath("$.error.code").value("maintenance"))
    }

    @Test
    fun `operator bypass reaches the configured security flow`() {
        mockMvc
            .perform(
                get("/api/auth/login/google")
                    .header(
                        "X-CherryK-Maintenance-Bypass",
                        "test-maintenance-token-with-32-characters",
                    ),
            ).andExpect(status().is3xxRedirection)
            .andExpect(
                header().string(
                    "Location",
                    org.hamcrest.Matchers.containsString("accounts.google.com"),
                ),
            )
    }
}
