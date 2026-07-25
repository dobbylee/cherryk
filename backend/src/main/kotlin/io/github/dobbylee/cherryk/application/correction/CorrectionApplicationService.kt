package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.application.usage.UsageFeature
import io.github.dobbylee.cherryk.application.usage.UsageQuota
import io.github.dobbylee.cherryk.application.usage.UsageReservation
import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.stereotype.Service
import java.time.Clock

data class CorrectionRequest(
    val text: String,
    val inputType: CorrectionInputType,
    val level: UserLevel,
)

data class CorrectionApplicationResult(
    val correctionId: Long,
    val originalText: String,
    val correctedText: String,
    val explanationEn: String,
    val mistakes: List<CorrectionMistake>,
    val recommendedTags: List<GrammarTag>,
)

@Service
class CorrectionApplicationService(
    private val usageQuota: UsageQuota,
    private val provider: CorrectionProvider,
    private val outputGuard: CorrectionOutputGuard,
    private val persistence: CorrectionPersistence,
    private val clock: Clock,
) {
    fun correct(
        userId: Long,
        request: CorrectionRequest,
    ): CorrectionApplicationResult {
        val reservation = usageQuota.reserve(userId, UsageFeature.CORRECTION, 1)
        val applicationResult =
            try {
                val output =
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
                val persisted =
                    persistence.persist(
                        CorrectionPersistenceInput(
                            userId = userId,
                            inputType = request.inputType,
                            originalText = request.text,
                            output = output,
                            now = clock.instant(),
                        ),
                    )
                CorrectionApplicationResult(
                    correctionId = persisted.correctionId,
                    originalText = request.text,
                    correctedText = output.correctedText,
                    explanationEn = output.explanationEn,
                    mistakes = output.mistakes,
                    recommendedTags = persisted.recommendedTags,
                )
            } catch (exception: RuntimeException) {
                releaseAfterFailure(reservation, exception)
            }

        usageQuota.commit(reservation)
        return applicationResult
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
