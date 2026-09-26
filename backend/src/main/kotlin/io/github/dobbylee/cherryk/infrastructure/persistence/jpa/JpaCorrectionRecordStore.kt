package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.application.correction.CorrectionPersistenceInput
import io.github.dobbylee.cherryk.application.correction.CorrectionRecordStore
import org.springframework.stereotype.Repository

@Repository
class JpaCorrectionRecordStore(
    private val correctionRepository: CorrectionJpaRepository,
) : CorrectionRecordStore {
    override fun create(input: CorrectionPersistenceInput): Long {
        val correction =
            CorrectionEntity(
                userId = input.userId,
                inputType = input.inputType,
                originalText = input.originalText,
                correctedText = input.output.correctedText,
                explanationEn = input.output.explanationEn,
                createdAt = input.now,
            ).apply {
                input.output.mistakes.forEach { mistake ->
                    addMistake(
                        tag = mistake.tag,
                        originalPart = mistake.originalPart,
                        correctedPart = mistake.correctedPart,
                        explanationEn = mistake.explanationEn,
                        severity = mistake.severity,
                        createdAt = input.now,
                    )
                }
            }
        return correctionRepository.saveAndFlush(correction).id
    }
}
