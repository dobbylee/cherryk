package io.github.dobbylee.cherryk.infrastructure.security

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController

@WebMvcTest(SecurityProbeController::class)
@Import(SecurityConfiguration::class)
class SecurityConfigurationTest(
    @Autowired private val mockMvc: MockMvc,
) {
    @Test
    fun `unauthenticated requests return the frozen API error shape`() {
        mockMvc
            .perform(get("/test/protected"))
            .andExpect(status().isUnauthorized)
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.error.code").value("unauthorized"))
            .andExpect(jsonPath("$.error.message").value("Authentication required."))
    }

    @Test
    fun `missing CSRF token returns the frozen API error shape`() {
        mockMvc
            .perform(post("/test/protected"))
            .andExpect(status().isForbidden)
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.error.code").value("forbidden"))
            .andExpect(jsonPath("$.error.message").value("Access is not allowed."))
    }
}

@RestController
class SecurityProbeController {
    @GetMapping("/test/protected")
    fun getProtected() = "ok"

    @PostMapping("/test/protected")
    fun postProtected() = "ok"
}
