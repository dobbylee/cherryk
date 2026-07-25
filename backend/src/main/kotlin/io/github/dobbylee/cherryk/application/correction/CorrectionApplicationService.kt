package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.application.usage.UsageFeature
import io.github.dobbylee.cherryk.application.usage.UsageQuota
import io.github.dobbylee.cherryk.application.usage.UsageReservation
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.stereotype.Service

data class CorrectionRequest(
    val text: String,
    val level: UserLevel,
)

@Service
class CorrectionApplicationService(
    private val usageQuota: UsageQuota,
    private val provider: CorrectionProvider,
    private val outputGuard: CorrectionOutputGuard,
) {
    fun correct(
        userId: Long,
        request: CorrectionRequest,
    ): CorrectionResult {
        val reservation = usageQuota.reserve(userId, UsageFeature.CORRECTION, 1)
        val result =
            try {
                outputGuard.guard(
                    originalText = request.text,
                    output =
                        provider.correct(
                            CorrectionProviderInput(
                                text = request.text,
                                level = request.level,
                            ),
                        ),
                )
            } catch (exception: RuntimeException) {
                releaseAfterFailure(reservation, exception)
            }

        usageQuota.commit(reservation)
        return result
    }

    private fun releaseAfterFailure(
        reservation: UsageReservation,
        failure: RuntimeException,
    ): Nothing {
        try {
            usageQuota.release(reservation)
        } catch (releaseFailure: RuntimeException) {
            failure.addSuppressed(releaseFailure)
        }
        throw failure
    }
}
