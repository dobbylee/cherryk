package io.github.dobbylee.cherryk.infrastructure.security

import io.github.dobbylee.cherryk.presentation.apiError
import jakarta.servlet.FilterChain
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseCookie
import org.springframework.web.filter.OncePerRequestFilter
import tools.jackson.databind.ObjectMapper
import java.security.MessageDigest
import java.time.Duration
import java.util.Base64

class MaintenanceModeFilter(
    private val objectMapper: ObjectMapper,
    private val writeFrozenEnabled: Boolean,
    private val bypassToken: String,
    private val secureCookies: Boolean,
) : OncePerRequestFilter() {
    override fun doFilterInternal(
        request: HttpServletRequest,
        response: HttpServletResponse,
        filterChain: FilterChain,
    ) {
        if (!writeFrozenEnabled) {
            filterChain.doFilter(request, response)
            return
        }

        if (request.requestURI == BYPASS_PATH) {
            handleBypassRequest(request, response)
            return
        }

        if (!isProtectedApiPath(request.requestURI) || hasOperatorBypass(request)) {
            filterChain.doFilter(request, response)
            return
        }

        writeError(
            response,
            HttpStatus.SERVICE_UNAVAILABLE,
            "maintenance",
            "CherryK is temporarily read-only.",
        )
    }

    private fun isProtectedApiPath(path: String): Boolean =
        isAtOrBelow(path, "/api/auth") || isAtOrBelow(path, "/api/v1")

    private fun isAtOrBelow(
        path: String,
        basePath: String,
    ): Boolean = path == basePath || path.startsWith("$basePath/")

    private fun handleBypassRequest(
        request: HttpServletRequest,
        response: HttpServletResponse,
    ) {
        when (request.method) {
            "DELETE" -> {
                response.addHeader(
                    HttpHeaders.SET_COOKIE,
                    bypassCookie("", Duration.ZERO).toString(),
                )
                response.status = HttpStatus.NO_CONTENT.value()
                response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
            }

            "POST" -> {
                if (!matchesConfiguredToken(request.getHeader(BYPASS_HEADER))) {
                    writeError(
                        response,
                        HttpStatus.FORBIDDEN,
                        "forbidden",
                        "Access is not allowed.",
                    )
                    return
                }

                response.addHeader(
                    HttpHeaders.SET_COOKIE,
                    bypassCookie(digestToken(bypassToken), BYPASS_COOKIE_MAX_AGE).toString(),
                )
                response.status = HttpStatus.NO_CONTENT.value()
                response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
            }

            else ->
                writeError(
                    response,
                    HttpStatus.METHOD_NOT_ALLOWED,
                    "method_not_allowed",
                    "Method is not allowed.",
                )
        }
    }

    private fun hasOperatorBypass(request: HttpServletRequest): Boolean {
        if (!hasValidConfiguredToken()) {
            return false
        }

        if (matchesConfiguredToken(request.getHeader(BYPASS_HEADER))) {
            return true
        }

        val cookieValue =
            request.cookies
                ?.firstOrNull { it.name == BYPASS_COOKIE }
                ?.value
        return timingSafeMatches(cookieValue, digestToken(bypassToken))
    }

    private fun matchesConfiguredToken(candidate: String?): Boolean =
        hasValidConfiguredToken() && timingSafeMatches(candidate, bypassToken)

    private fun hasValidConfiguredToken() = bypassToken.length >= MINIMUM_BYPASS_TOKEN_LENGTH

    private fun bypassCookie(
        value: String,
        maxAge: Duration,
    ) = ResponseCookie
        .from(BYPASS_COOKIE, value)
        .httpOnly(true)
        .secure(secureCookies)
        .sameSite("Lax")
        .path("/")
        .maxAge(maxAge)
        .build()

    private fun writeError(
        response: HttpServletResponse,
        status: HttpStatus,
        code: String,
        message: String,
    ) {
        response.status = status.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store")
        if (status == HttpStatus.SERVICE_UNAVAILABLE) {
            response.setHeader(HttpHeaders.RETRY_AFTER, "300")
        }
        objectMapper.writeValue(response.outputStream, apiError(code, message))
    }

    private fun digestToken(value: String): String =
        Base64
            .getUrlEncoder()
            .withoutPadding()
            .encodeToString(sha256(value))

    private fun timingSafeMatches(
        candidate: String?,
        expected: String,
    ): Boolean {
        if (candidate == null) {
            return false
        }
        return MessageDigest.isEqual(sha256(candidate), sha256(expected))
    }

    private fun sha256(value: String) =
        MessageDigest
            .getInstance("SHA-256")
            .digest(value.toByteArray(Charsets.UTF_8))

    private companion object {
        const val BYPASS_HEADER = "X-CherryK-Maintenance-Bypass"
        const val BYPASS_COOKIE = "CHERRYK_MAINTENANCE_BYPASS"
        const val BYPASS_PATH = "/api/maintenance/bypass"
        const val MINIMUM_BYPASS_TOKEN_LENGTH = 32
        val BYPASS_COOKIE_MAX_AGE: Duration = Duration.ofHours(8)
    }
}
