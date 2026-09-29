package io.github.dobbylee.cherryk.learning.presentation

import io.github.dobbylee.cherryk.learning.application.LearningRhythmService
import io.github.dobbylee.cherryk.presentation.auth.CurrentUserResolver
import org.springframework.http.CacheControl
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.core.oidc.user.OidcUser
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
class LearningRhythmController(
    private val currentUserResolver: CurrentUserResolver,
    private val service: LearningRhythmService,
) {
    @GetMapping("/api/v1/learning/rhythm")
    fun read(
        @AuthenticationPrincipal principal: OidcUser?,
        @RequestParam(required = false) timeZone: String?,
    ): ResponseEntity<LearningRhythmResponse> {
        val user = currentUserResolver.resolve(principal) ?: throw LearningAuthenticationRequired()
        val rhythm = service.read(user.id, timeZone.orEmpty())
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(
            LearningRhythmResponse(
                rhythm.timeZone, rhythm.today.toString(), rhythm.currentStreak,
                rhythm.days.map { LearningDayResponse(it.date.toString(), it.active) },
            ),
        )
    }
}

data class LearningDayResponse(val date: String, val active: Boolean)
data class LearningRhythmResponse(
    val timeZone: String,
    val today: String,
    val currentStreak: Int,
    val days: List<LearningDayResponse>,
)
class LearningAuthenticationRequired : RuntimeException()
