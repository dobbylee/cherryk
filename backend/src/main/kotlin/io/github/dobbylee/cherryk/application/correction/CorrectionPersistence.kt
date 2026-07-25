package io.github.dobbylee.cherryk.application.correction

import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant

data class CorrectionPersistenceInput(
    val userId: Long,
    val inputType: CorrectionInputType,
    val originalText: String,
    val output: CorrectionResult,
    val now: Instant,
)

data class PersistedCorrection(
    val correctionId: Long,
    val recommendedTags: List<GrammarTag>,
)

fun interface CorrectionRecordStore {
    fun create(
        input: CorrectionPersistenceInput,
        recommendedTags: List<GrammarTag>,
    ): Long
}

interface CorrectionPersistence {
    fun persist(input: CorrectionPersistenceInput): PersistedCorrection
}

@Service
class TransactionalCorrectionPersistence(
    private val store: CorrectionRecordStore,
) : CorrectionPersistence {
    @Transactional
    override fun persist(input: CorrectionPersistenceInput): PersistedCorrection {
        val recommendedTags = input.output.mistakes.map(CorrectionMistake::tag).distinct()
        val correctionId = store.create(input, recommendedTags)
        return PersistedCorrection(
            correctionId = correctionId,
            recommendedTags = recommendedTags,
        )
    }
}
