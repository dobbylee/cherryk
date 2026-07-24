package io.github.dobbylee.cherryk.infrastructure.security

import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import tools.jackson.databind.ObjectMapper

@Configuration
class SecurityConfiguration(
    private val objectMapper: ObjectMapper,
) {
    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .authorizeHttpRequests { requests ->
                requests
                    .requestMatchers("/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .anyRequest()
                    .authenticated()
            }
            .httpBasic { basic -> basic.disable() }
            .formLogin { form -> form.disable() }
            .requestCache { cache -> cache.disable() }
            .exceptionHandling { exceptions ->
                exceptions
                    .authenticationEntryPoint { _, response, _ ->
                        writeApiError(
                            response,
                            HttpStatus.UNAUTHORIZED,
                            "unauthorized",
                            "Authentication required.",
                        )
                    }.accessDeniedHandler { _, response, _ ->
                        writeApiError(
                            response,
                            HttpStatus.FORBIDDEN,
                            "forbidden",
                            "Access is not allowed.",
                        )
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
