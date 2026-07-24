package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.correction.CorrectionInputType
import io.github.dobbylee.cherryk.domain.correction.MistakeSeverity
import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "corrections")
class CorrectionEntity(
    id: UUID = UUID.randomUUID(),
    userId: UUID,
    inputType: CorrectionInputType,
    originalText: String,
    correctedText: String,
    naturalText: String? = null,
    explanationEn: String? = null,
    createdAt: Instant = Instant.now(),
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:Column(name = "user_id", nullable = false, updatable = false)
    var userId: UUID = userId
        protected set

    @field:Convert(converter = CorrectionInputTypeConverter::class)
    @field:Column(name = "input_type", nullable = false, columnDefinition = "text")
    var inputType: CorrectionInputType = inputType
        protected set

    @field:Column(name = "original_text", nullable = false, columnDefinition = "text")
    var originalText: String = originalText
        protected set

    @field:Column(name = "corrected_text", nullable = false, columnDefinition = "text")
    var correctedText: String = correctedText
        protected set

    @field:Column(name = "natural_text", columnDefinition = "text")
    var naturalText: String? = naturalText
        protected set

    @field:Column(name = "explanation_en", columnDefinition = "text")
    var explanationEn: String? = explanationEn
        protected set

    @field:Column(name = "created_at", nullable = false)
    var createdAt: Instant = createdAt
        protected set

    @field:OneToMany(mappedBy = "correction", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    private val mistakeEntities: MutableList<CorrectionMistakeEntity> = mutableListOf()

    val mistakes: List<CorrectionMistakeEntity>
        get() = mistakeEntities.toList()

    fun addMistake(
        tag: GrammarTag,
        originalPart: String?,
        correctedPart: String?,
        explanationEn: String?,
        severity: MistakeSeverity,
        id: UUID = UUID.randomUUID(),
        createdAt: Instant = Instant.now(),
    ) {
        mistakeEntities +=
            CorrectionMistakeEntity(
                id = id,
                correction = this,
                tag = tag,
                originalPart = originalPart,
                correctedPart = correctedPart,
                explanationEn = explanationEn,
                severity = severity,
                createdAt = createdAt,
            )
    }
}

@Entity
@Table(name = "correction_mistakes")
class CorrectionMistakeEntity(
    id: UUID = UUID.randomUUID(),
    correction: CorrectionEntity,
    tag: GrammarTag,
    originalPart: String? = null,
    correctedPart: String? = null,
    explanationEn: String? = null,
    severity: MistakeSeverity = MistakeSeverity.MINOR,
    createdAt: Instant = Instant.now(),
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:ManyToOne(fetch = FetchType.LAZY, optional = false)
    @field:JoinColumn(name = "correction_id", nullable = false, updatable = false)
    lateinit var correction: CorrectionEntity
        protected set

    @field:Convert(converter = GrammarTagConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var tag: GrammarTag = tag
        protected set

    @field:Column(name = "original_part", columnDefinition = "text")
    var originalPart: String? = originalPart
        protected set

    @field:Column(name = "corrected_part", columnDefinition = "text")
    var correctedPart: String? = correctedPart
        protected set

    @field:Column(name = "explanation_en", columnDefinition = "text")
    var explanationEn: String? = explanationEn
        protected set

    @field:Convert(converter = MistakeSeverityConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var severity: MistakeSeverity = severity
        protected set

    @field:Column(name = "created_at", nullable = false)
    var createdAt: Instant = createdAt
        protected set

    init {
        this.correction = correction
    }
}
