package io.github.dobbylee.cherryk.infrastructure.persistence.jpa

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizSource
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.user.UserLevel
import jakarta.persistence.CascadeType
import jakarta.persistence.Column
import jakarta.persistence.Convert
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "quiz_questions")
class QuizEntity(
    tag: GrammarTag,
    quizType: QuizType = QuizType.GRAMMAR,
    difficulty: UserLevel,
    contentFingerprint: String,
    supersedesQuizId: Long? = null,
    status: QuizStatus,
    questionEn: String,
    sentenceKo: String?,
    answerExplanationEn: String,
    source: QuizSource = QuizSource.AI_DRAFT,
    createdAt: Instant = Instant.now(),
    updatedAt: Instant = createdAt,
) {
    @field:Id
    @field:GeneratedValue(strategy = GenerationType.IDENTITY)
    @field:Column(nullable = false, updatable = false)
    var id: Long = 0
        protected set

    @field:Convert(converter = GrammarTagConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var tag: GrammarTag = tag
        protected set

    @field:Convert(converter = QuizTypeConverter::class)
    @field:Column(name = "quiz_type", nullable = false, columnDefinition = "text")
    var quizType: QuizType = quizType
        protected set

    @field:Convert(converter = UserLevelConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var difficulty: UserLevel = difficulty
        protected set

    @field:Column(
        name = "content_fingerprint",
        nullable = false,
        columnDefinition = "text",
    )
    var contentFingerprint: String = contentFingerprint
        protected set

    @field:Column(name = "supersedes_quiz_id")
    var supersedesQuizId: Long? = supersedesQuizId
        protected set

    @field:Convert(converter = QuizStatusConverter::class)
    @field:Column(nullable = false, columnDefinition = "text")
    var status: QuizStatus = status
        protected set

    @field:Column(name = "question_en", nullable = false, columnDefinition = "text")
    var questionEn: String = questionEn
        protected set

    @field:Column(name = "sentence_ko", columnDefinition = "text")
    var sentenceKo: String? = sentenceKo
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

    val choices: List<QuizChoiceSnapshot>
        get() =
            choiceEntities.map { choice ->
                QuizChoiceSnapshot(
                    id = choice.id,
                    text = choice.text,
                    correct = choice.correct,
                    sortOrder = choice.sortOrder,
                )
            }

    fun addChoice(
        text: String,
        correct: Boolean,
        sortOrder: Int,
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
                quiz = this,
                text = text,
                correct = correct,
                sortOrder = sortOrder,
            )
    }

    fun content(): QuizContent =
        QuizContent(
            tag = tag,
            difficulty = difficulty,
            questionEn = questionEn,
            sentenceKo = sentenceKo,
            choices =
                choiceEntities
                    .sortedBy(QuizChoiceEntity::sortOrder)
                    .map { choice ->
                        QuizChoiceContent(
                            text = choice.text,
                            correct = choice.correct,
                            sortOrder = choice.sortOrder,
                        )
                    },
            answerExplanationEn = answerExplanationEn,
            quizType = quizType,
        )

    fun editDraft(
        content: QuizContent,
        now: Instant,
    ) {
        require(status == QuizStatus.DRAFT) { "Only draft quizzes are editable." }

        tag = content.tag
        difficulty = content.difficulty
        questionEn = content.questionEn
        sentenceKo = content.sentenceKo
        answerExplanationEn = content.answerExplanationEn
        contentFingerprint = content.fingerprint()
        replaceChoices(content.choices)
        updatedAt = now
    }

    fun clearCorrectChoiceBeforeReplacement(newCorrectSortOrder: Int): Boolean {
        require(status == QuizStatus.DRAFT) { "Only draft quizzes are editable." }
        val currentCorrect = choiceEntities.singleOrNull(QuizChoiceEntity::correct) ?: return false
        if (currentCorrect.sortOrder == newCorrectSortOrder) {
            return false
        }
        currentCorrect.updateDraftChoice(
            text = currentCorrect.text,
            correct = false,
        )
        return true
    }

    fun approve(now: Instant) {
        require(status == QuizStatus.DRAFT) { "Only draft quizzes can be approved." }
        content()
        status = QuizStatus.APPROVED
        updatedAt = now
    }

    fun retire(now: Instant) {
        require(status == QuizStatus.APPROVED) { "Only approved quizzes can be retired." }
        status = QuizStatus.RETIRED
        updatedAt = now
    }

    private fun replaceChoices(choices: List<QuizChoiceContent>) {
        if (choiceEntities.isEmpty()) {
            choices.sortedBy(QuizChoiceContent::sortOrder).forEach { choice ->
                addChoice(
                    text = choice.text,
                    correct = choice.correct,
                    sortOrder = choice.sortOrder,
                )
            }
            return
        }

        require(choiceEntities.size == 4) { "Persisted quiz must contain exactly four choices." }
        val existingByOrder = choiceEntities.associateBy(QuizChoiceEntity::sortOrder)
        choices.forEach { choice ->
            requireNotNull(existingByOrder[choice.sortOrder]) {
                "Persisted quiz choice sortOrder values must be exactly zero through three."
            }.updateDraftChoice(
                text = choice.text,
                correct = choice.correct,
            )
        }
    }

    companion object {
        fun createDraft(
            content: QuizContent,
            supersedesQuizId: Long? = null,
            source: QuizSource = QuizSource.AI_DRAFT,
            now: Instant = Instant.now(),
        ): QuizEntity =
            QuizEntity(
                tag = content.tag,
                quizType = content.quizType,
                difficulty = content.difficulty,
                contentFingerprint = content.fingerprint(),
                supersedesQuizId = supersedesQuizId,
                status = QuizStatus.DRAFT,
                questionEn = content.questionEn,
                sentenceKo = content.sentenceKo,
                answerExplanationEn = content.answerExplanationEn,
                source = source,
                createdAt = now,
                updatedAt = now,
            ).apply {
                content.choices.sortedBy(QuizChoiceContent::sortOrder).forEach { choice ->
                    addChoice(
                        text = choice.text,
                        correct = choice.correct,
                        sortOrder = choice.sortOrder,
                    )
                }
            }
    }
}

data class QuizChoiceSnapshot(
    val id: Long,
    val text: String,
    val correct: Boolean,
    val sortOrder: Int,
)

@Entity
@Table(name = "quiz_choices")
internal class QuizChoiceEntity(
    quiz: QuizEntity,
    text: String,
    correct: Boolean,
    sortOrder: Int,
) {
    @field:Id
    @field:GeneratedValue(strategy = GenerationType.IDENTITY)
    @field:Column(nullable = false, updatable = false)
    var id: Long = 0
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

    internal fun updateDraftChoice(
        text: String,
        correct: Boolean,
    ) {
        require(quiz.status == QuizStatus.DRAFT) { "Only draft quiz choices are editable." }
        require(text.isNotBlank()) { "Quiz choice text must not be blank." }
        this.text = text
        this.correct = correct
    }
}

@Entity
@Table(name = "quiz_attempts")
class QuizAttemptEntity(
    userId: Long,
    quizQuestionId: Long,
    selectedChoiceId: Long,
    correct: Boolean,
    createdAt: Instant = Instant.now(),
) {
    @field:Id
    @field:GeneratedValue(strategy = GenerationType.IDENTITY)
    @field:Column(nullable = false, updatable = false)
    var id: Long = 0
        protected set

    @field:Column(name = "user_id", nullable = false, updatable = false)
    var userId: Long = userId
        protected set

    @field:Column(name = "quiz_question_id", nullable = false, updatable = false)
    var quizQuestionId: Long = quizQuestionId
        protected set

    @field:Column(name = "selected_choice_id", nullable = false, updatable = false)
    var selectedChoiceId: Long = selectedChoiceId
        protected set

    @field:Column(name = "is_correct", nullable = false, updatable = false)
    var correct: Boolean = correct
        protected set

    @field:Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant = createdAt
        protected set
}
