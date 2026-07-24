package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizSource
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.user.UserLevel
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
@Table(name = "quiz_questions")
class QuizEntity(
    id: UUID = UUID.randomUUID(),
    tag: GrammarTag,
    difficulty: UserLevel,
    contentFingerprint: String,
    status: QuizStatus,
    questionEn: String,
    sentenceKo: String,
    answerExplanationEn: String,
    source: QuizSource = QuizSource.AI_DRAFT,
    createdAt: Instant = Instant.now(),
    updatedAt: Instant = createdAt,
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:Convert(converter = GrammarTagConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var tag: GrammarTag = tag
        protected set

    @field:Convert(converter = UserLevelConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var difficulty: UserLevel = difficulty
        protected set

    @field:Column(
        name = "content_fingerprint",
        nullable = false,
        unique = true,
        columnDefinition = "text",
    )
    var contentFingerprint: String = contentFingerprint
        protected set

    @field:Convert(converter = QuizStatusConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var status: QuizStatus = status
        protected set

    @field:Column(name = "question_en", nullable = false, columnDefinition = "text")
    var questionEn: String = questionEn
        protected set

    @field:Column(name = "sentence_ko", nullable = false, columnDefinition = "text")
    var sentenceKo: String = sentenceKo
        protected set

    @field:Column(name = "answer_explanation_en", nullable = false, columnDefinition = "text")
    var answerExplanationEn: String = answerExplanationEn
        protected set

    @field:Convert(converter = QuizSourceConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var source: QuizSource = source
        protected set

    @field:Column(name = "created_at", nullable = false)
    var createdAt: Instant = createdAt
        protected set

    @field:Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = updatedAt
        protected set

    @field:OneToMany(mappedBy = "quiz", fetch = FetchType.LAZY, cascade = [CascadeType.ALL], orphanRemoval = true)
    private val choiceEntities: MutableList<QuizChoiceEntity> = mutableListOf()

    val choices: List<QuizChoiceEntity>
        get() = choiceEntities.toList()

    fun addChoice(
        text: String,
        correct: Boolean,
        sortOrder: Int,
        id: UUID = UUID.randomUUID(),
    ) {
        require(choiceEntities.none { it.sortOrder == sortOrder }) {
            "Quiz choice sortOrder must be unique."
        }
        require(choiceEntities.size < 4) {
            "Quiz cannot contain more than four choices."
        }
        require(!correct || choiceEntities.none { it.correct }) {
            "Quiz cannot contain more than one correct choice."
        }
        choiceEntities +=
            QuizChoiceEntity(
                id = id,
                quiz = this,
                text = text,
                correct = correct,
                sortOrder = sortOrder,
            )
    }
}

@Entity
@Table(name = "quiz_choices")
class QuizChoiceEntity(
    id: UUID = UUID.randomUUID(),
    quiz: QuizEntity,
    text: String,
    correct: Boolean,
    sortOrder: Int,
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:ManyToOne(fetch = FetchType.LAZY, optional = false)
    @field:JoinColumn(name = "quiz_question_id", nullable = false, updatable = false)
    lateinit var quiz: QuizEntity
        protected set

    @field:Column(name = "choice_text", nullable = false, columnDefinition = "text")
    var text: String = text
        protected set

    @field:Column(name = "is_correct", nullable = false)
    var correct: Boolean = correct
        protected set

    @field:Column(name = "sort_order", nullable = false)
    var sortOrder: Int = sortOrder
        protected set

    init {
        this.quiz = quiz
    }
}

@Entity
@Table(name = "quiz_attempts")
class QuizAttemptEntity(
    id: UUID = UUID.randomUUID(),
    userId: UUID,
    quizQuestionId: UUID,
    selectedChoiceId: UUID?,
    correct: Boolean,
    createdAt: Instant = Instant.now(),
) {
    @field:Id
    @field:Column(nullable = false, updatable = false)
    var id: UUID = id
        protected set

    @field:Column(name = "user_id", nullable = false, updatable = false)
    var userId: UUID = userId
        protected set

    @field:Column(name = "quiz_question_id", nullable = false, updatable = false)
    var quizQuestionId: UUID = quizQuestionId
        protected set

    @field:Column(name = "selected_choice_id", updatable = false)
    var selectedChoiceId: UUID? = selectedChoiceId
        protected set

    @field:Column(name = "is_correct", nullable = false, updatable = false)
    var correct: Boolean = correct
        protected set

    @field:Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant = createdAt
        protected set
}
