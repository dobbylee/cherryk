package io.github.dobbylee.cherryk.infrastructure.security

import jakarta.servlet.http.HttpServletResponse
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.authentication.AnonymousAuthenticationToken
import org.springframework.security.authentication.InsufficientAuthenticationException
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.security.web.authentication.logout.HttpStatusReturningLogoutSuccessHandler
import org.springframework.security.web.csrf.CookieCsrfTokenRepository
import org.springframework.security.web.SecurityFilterChain
import tools.jackson.databind.ObjectMapper

@Configuration
class SecurityConfiguration(
    private val objectMapper: ObjectMapper,
    private val oidcUserService: ProvisioningOidcUserService,
    private val adminAuthorizationManager: AdminAuthorizationManager,
    @Value("\${cherryk.security.secure-cookies:true}")
    private val secureCookies: Boolean,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        val authenticationEntryPoint =
            AuthenticationEntryPoint { _, response, _ ->
                writeApiError(
                    response,
                    HttpStatus.UNAUTHORIZED,
                    "unauthorized",
                    "Authentication required.",
                )
            }
        val csrfTokenRepository =
            CookieCsrfTokenRepository.withHttpOnlyFalse().apply {
                setCookiePath("/")
                setCookieCustomizer { cookie ->
                    cookie
                        .httpOnly(false)
                        .secure(secureCookies)
                        .sameSite("Lax")
                }
            }

        http
            .authorizeHttpRequests { requests ->
                requests
                    .requestMatchers(
                        "/actuator/health",
                        "/actuator/health/**",
                        "/api/v1/auth/me",
                        "/api/auth/login/**",
                        "/api/auth/callback/**",
                    )
                    .permitAll()
                    .requestMatchers("/api/v1/admin/**")
                    .access(adminAuthorizationManager)
                    .anyRequest()
                    .authenticated()
            }
            .oauth2Login { oauth ->
                oauth
                    .defaultSuccessUrl("/", true)
                    .failureUrl("/?authError=login_failed")
                    .authorizationEndpoint { authorization ->
                        authorization.baseUri("/api/auth/login")
                    }
                    .redirectionEndpoint { redirection ->
                        redirection.baseUri("/api/auth/callback/*")
                    }
                    .userInfoEndpoint { userInfo ->
                        userInfo.oidcUserService(oidcUserService)
                    }
            }
            .logout { logout ->
                logout
                    .logoutUrl("/api/auth/logout")
                    .logoutSuccessHandler(
                        HttpStatusReturningLogoutSuccessHandler(HttpStatus.NO_CONTENT),
                    )
                    .deleteCookies("CHERRYK_SESSION")
            }
            .csrf { csrf ->
                csrf
                    .spa()
                    .csrfTokenRepository(csrfTokenRepository)
            }
            .httpBasic { basic -> basic.disable() }
            .formLogin { form -> form.disable() }
            .requestCache { cache -> cache.disable() }
            .exceptionHandling { exceptions ->
                exceptions
                    .authenticationEntryPoint(authenticationEntryPoint)
                    .accessDeniedHandler { request, response, _ ->
                        val authentication = SecurityContextHolder.getContext().authentication
                        if (
                            authentication == null ||
                            !authentication.isAuthenticated ||
                            authentication is AnonymousAuthenticationToken
                        ) {
                            authenticationEntryPoint.commence(
                                request,
                                response,
                                InsufficientAuthenticationException("Authentication required."),
                            )
                        } else {
                            writeApiError(
                                response,
                                HttpStatus.FORBIDDEN,
                                "forbidden",
                                "Access is not allowed.",
                            )
                        }
                    }
            }

        return http.build()
    }

    private fun writeApiError(
        response: HttpServletResponse,
        status: HttpStatus,
        code: String,
        message: String,
    ) {
        response.status = status.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        objectMapper.writeValue(
            response.outputStream,
            ApiErrorResponse(error = ApiErrorBody(code = code, message = message)),
        )
    }
}

private data class ApiErrorResponse(
    val error: ApiErrorBody,
)

private data class ApiErrorBody(
    val code: String,
    val message: String,
)
