package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.application.auth.AuthenticatedUser
import io.github.dobbylee.cherryk.application.auth.GOOGLE_ISSUER
import io.github.dobbylee.cherryk.application.auth.OidcIdentityProfile
import io.github.dobbylee.cherryk.application.auth.OidcIdentityResolver
import io.github.dobbylee.cherryk.domain.user.UserLevel
import io.github.dobbylee.cherryk.presentation.auth.AuthController
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository
import org.springframework.security.oauth2.core.AuthorizationGrantType
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.oidcLogin
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@WebMvcTest(
    controllers = [SecurityProbeController::class, AuthController::class],
    properties = ["cherryk.security.secure-cookies=false"],
)
@Import(SecurityConfiguration::class, SecurityTestConfiguration::class)
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
            .andExpect(status().isUnauthorized)
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.error.code").value("unauthorized"))
            .andExpect(jsonPath("$.error.message").value("Authentication required."))

        mockMvc
            .perform(post("/test/protected").with(oidcUser()))
            .andExpect(status().isForbidden)
            .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
            .andExpect(jsonPath("$.error.code").value("forbidden"))
            .andExpect(jsonPath("$.error.message").value("Access is not allowed."))
    }

    @Test
    fun `Google login endpoint starts the authorization code flow`() {
        mockMvc
            .perform(get("/api/auth/login/google"))
            .andExpect(status().is3xxRedirection)
            .andExpect(header().string("Location", org.hamcrest.Matchers.containsString("accounts.google.com")))
            .andExpect(
                header().string(
                    "Location",
                    org.hamcrest.Matchers.containsString(
                        "redirect_uri=http://localhost/api/auth/callback/google",
                    ),
                ),
            )
    }

    @Test
    fun `me preserves the public contract and issues a CSRF cookie`() {
        mockMvc
            .perform(get("/api/v1/auth/me"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.user").isEmpty)
            .andExpect(cookie().exists("XSRF-TOKEN"))

        mockMvc
            .perform(get("/api/v1/auth/me").with(oidcUser()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.user.id").value(TEST_USER_ID.toString()))
            .andExpect(jsonPath("$.user.displayName").value("Cherry"))
            .andExpect(jsonPath("$.user.level").value("beginner"))
    }

    @Test
    fun `logout requires CSRF and returns no content`() {
        mockMvc
            .perform(post("/api/auth/logout").with(oidcUser()))
            .andExpect(status().isForbidden)

        val csrfCookie =
            requireNotNull(
                mockMvc
                    .perform(get("/api/v1/auth/me"))
                    .andReturn()
                    .response
                    .getCookie("XSRF-TOKEN"),
            )
        mockMvc
            .perform(
                post("/api/auth/logout")
                    .with(oidcUser())
                    .cookie(csrfCookie)
                    .header("X-XSRF-TOKEN", csrfCookie.value),
            ).andExpect(status().isNoContent)
    }

    @Test
    fun `admin access requires a verified allowlisted Google email`() {
        mockMvc
            .perform(get("/api/v1/admin/probe").with(oidcUser(email = "learner@example.com")))
            .andExpect(status().isForbidden)

        mockMvc
            .perform(
                get("/api/v1/admin/probe").with(
                    oidcUser(email = "admin@example.com", emailVerified = false),
                ),
            ).andExpect(status().isForbidden)

        mockMvc
            .perform(get("/api/v1/admin/probe").with(oidcUser(email = " ADMIN@example.com ")))
            .andExpect(status().isOk)
            .andExpect(content().string("admin"))
    }

    private fun oidcUser(
        email: String = "learner@example.com",
        emailVerified: Boolean = true,
    ) = oidcLogin().idToken { token ->
        token
            .issuer(GOOGLE_ISSUER)
            .subject("google-subject")
            .claim("email", email)
            .claim("email_verified", emailVerified)
            .claim("name", "Cherry")
    }
}

@TestConfiguration
class SecurityTestConfiguration {
    @Bean
    fun identityResolver(): OidcIdentityResolver =
        object : OidcIdentityResolver {
            override fun resolveOrCreate(profile: OidcIdentityProfile) =
                AuthenticatedUser(TEST_USER_ID, "Cherry", UserLevel.BEGINNER)

            override fun findExisting(
                issuer: String,
                subject: String,
            ) = if (issuer == GOOGLE_ISSUER && subject == "google-subject") {
                AuthenticatedUser(TEST_USER_ID, "Cherry", UserLevel.BEGINNER)
            } else {
                null
            }
        }

    @Bean
    fun provisioningOidcUserService(identityResolver: OidcIdentityResolver) =
        ProvisioningOidcUserService(identityResolver)

    @Bean
    fun adminAuthorizationManager() = AdminAuthorizationManager("admin@example.com")

    @Bean
    fun clientRegistrationRepository(): ClientRegistrationRepository =
        InMemoryClientRegistrationRepository(
            ClientRegistration
                .withRegistrationId("google")
                .clientId("test-google-client")
                .clientSecret("test-google-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("{baseUrl}/api/auth/callback/{registrationId}")
                .scope("openid", "profile", "email")
                .authorizationUri("https://accounts.google.com/o/oauth2/v2/auth")
                .tokenUri("https://oauth2.googleapis.com/token")
                .jwkSetUri("https://www.googleapis.com/oauth2/v3/certs")
                .userInfoUri("https://openidconnect.googleapis.com/v1/userinfo")
                .userNameAttributeName("sub")
                .clientName("Google")
                .build(),
        )
}

@RestController
class SecurityProbeController {
    @GetMapping("/test/protected")
    fun getProtected() = "ok"

    @PostMapping("/test/protected")
    fun postProtected() = "ok"

    @GetMapping("/api/v1/admin/probe")
    fun adminProtected() = "admin"
}

private val TEST_USER_ID = UUID.fromString("10000000-0000-4000-8000-000000000001")
