package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.grammar.GrammarTag
import io.github.dobbylee.cherryk.domain.quiz.QuizChoiceContent
import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizStatus
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import io.github.dobbylee.cherryk.domain.quiz.learningTarget
import io.github.dobbylee.cherryk.domain.quiz.normalizeLearningTarget
import io.github.dobbylee.cherryk.domain.user.UserLevel
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock

data class AdminQuizDraftRequest(
    val quizType: QuizType,
    val tag: GrammarTag,
    val difficulty: UserLevel,
    val count: Int,
    val instruction: String?,
)

data class AdminQuizDraft(
    val id: Long,
    val content: QuizContent,
)

data class AdminQuizTagCount(
    val tag: GrammarTag,
    val draftCount: Long,
    val approvedCount: Long,
) {
    val totalCount: Long
        get() = draftCount + approvedCount
}

fun interface AdminQuizInventoryRepository {
    fun countActiveQuizzesByTag(): List<AdminQuizTagCount>
}

data class AdminQuizUpdate(
    val tag: GrammarTag? = null,
    val difficulty: UserLevel? = null,
    val questionEn: String? = null,
    val sentenceKo: String? = null,
    val choices: List<QuizChoiceContent>? = null,
    val answerExplanationEn: String? = null,
    val status: QuizStatus? = null,
) {
    fun contentUpdate(): QuizDraftUpdate? =
        if (
            tag == null &&
            difficulty == null &&
            questionEn == null &&
            sentenceKo == null &&
            choices == null &&
            answerExplanationEn == null
        ) {
            null
        } else {
            QuizDraftUpdate(
                tag = tag,
                difficulty = difficulty,
                questionEn = questionEn,
                sentenceKo = sentenceKo,
                choices = choices,
                answerExplanationEn = answerExplanationEn,
            )
        }
}

class AdminQuizApplicationException(
    val code: String,
    message: String,
) : RuntimeException(message)

@Service
class AdminQuizApplicationService(
    private val provider: QuizDraftProvider,
    private val commands: QuizCommandService,
    private val inventory: AdminQuizInventoryRepository,
    private val vocabularyTargets: VocabularyTargetRepository,
    private val clock: Clock,
) {
    @Transactional(readOnly = true)
    fun getTagCounts(): List<AdminQuizTagCount> {
        val countsByTag = inventory.countActiveQuizzesByTag().associateBy(AdminQuizTagCount::tag)
        return GrammarTag.entries.map { tag ->
            countsByTag[tag] ?: AdminQuizTagCount(tag, draftCount = 0, approvedCount = 0)
        }
    }

    fun generateDrafts(request: AdminQuizDraftRequest): List<AdminQuizDraft> {
        val candidateContents = mutableListOf<QuizContent>()
        val candidateFingerprints = mutableSetOf<String>()
        val candidateLearningTargets = mutableSetOf<String>()
        val vocabularyClaims = mutableListOf<VocabularyTargetClaim>()
        val retryExclusions = linkedSetOf<String>()

        return try {
            var generationRound = 0
            while (generationRound < MAX_GENERATION_ROUNDS) {
                generationRound += 1
                val remainingCount = request.count - candidateContents.size
                if (remainingCount == 0) {
                    break
                }
                val vocabularyTargetsForRound =
                    if (request.quizType == QuizType.VOCABULARY) {
                        vocabularyTargets
                            .claimUnusedTargets(request.difficulty, remainingCount)
                            .also { claim ->
                                if (claim.words.isNotEmpty()) {
                                    vocabularyClaims += claim
                                }
                            }.words
                    } else {
                        emptyList()
                    }
                if (request.quizType == QuizType.VOCABULARY && vocabularyTargetsForRound.isEmpty()) {
                    break
                }
                val generationCount =
                    if (request.quizType == QuizType.VOCABULARY) {
                        vocabularyTargetsForRound.size
                    } else {
                        remainingCount
                    }
                val input =
                    QuizDraftProviderInput(
                        quizType = request.quizType,
                        tag = request.tag,
                        difficulty = request.difficulty,
                        count = generationCount,
                        instruction = request.instruction,
                        vocabularyTargets = vocabularyTargetsForRound,
                        avoidLearningTargets = retryExclusions.toList(),
                    )
                val contents = generateContents(input)
                validateProviderContents(contents, input)
                commands.findNovelDrafts(contents).forEach { content ->
                    val fingerprint = content.fingerprint()
                    val learningTargetIdentity = learningTargetIdentity(content)
                    if (
                        candidateFingerprints.add(fingerprint) &&
                        candidateLearningTargets.add(learningTargetIdentity)
                    ) {
                        candidateContents += content
                    }
                }
                contents.forEach { content ->
                    retryExclusions +=
                        content
                            .learningTarget()
                            .promptLabel
                            .trim()
                            .take(MAX_RETRY_EXCLUSION_LENGTH)
                }
                while (retryExclusions.size > MAX_RETRY_EXCLUSIONS) {
                    retryExclusions.remove(retryExclusions.first())
                }
            }

            commands.createDrafts(candidateContents, clock.instant()).map { created ->
                AdminQuizDraft(
                    id = created.result.quizId,
                    content = created.content,
                )
            }
        } finally {
            vocabularyClaims.forEach { claim ->
                vocabularyTargets.releaseClaim(claim.reservationKey)
            }
        }
    }

    private fun generateContents(input: QuizDraftProviderInput): List<QuizContent> =
        try {
            provider.generate(input)
        } catch (exception: QuizDraftProviderException) {
            if (exception.code == "invalid_response") {
                throw AdminQuizApplicationException(
                    code = "invalid_ai_output",
                    message = "AI quiz draft output is invalid.",
                )
            }
            throw exception
        }

    private fun validateProviderContents(
        contents: List<QuizContent>,
        input: QuizDraftProviderInput,
    ) {
        val hasExpectedShape =
            contents.size == input.count &&
                contents.all { content ->
                    content.quizType == input.quizType &&
                        content.tag == input.tag &&
                        content.difficulty == input.difficulty
                }
        val hasExpectedVocabularyTargets =
            input.quizType != QuizType.VOCABULARY ||
                contents.map { content ->
                    normalizeLearningTarget(
                        content.choices.single(QuizChoiceContent::correct).text,
                    )
                } == input.vocabularyTargets.map(::normalizeLearningTarget)
        if (!hasExpectedShape || !hasExpectedVocabularyTargets) {
            throw AdminQuizApplicationException(
                code = "invalid_ai_output",
                message = "AI quiz draft output is invalid.",
            )
        }
    }

    fun updateDraft(
        quizId: Long,
        update: AdminQuizUpdate,
    ): QuizCommandResult.Success {
        val result =
            try {
                commands.reviewDraft(
                    quizId = quizId,
                    update = update.contentUpdate(),
                    requestedStatus = update.status,
                    now = clock.instant(),
                )
            } catch (exception: QuizReviewRollbackException) {
                exception.failure
            } catch (exception: QuizDuplicateException) {
                throw AdminQuizApplicationException(
                    code = "quiz_duplicate",
                    message = "A quiz with the same content or learning target already exists.",
                )
            }

        return result.requireSuccess()
    }

    fun rejectDraft(quizId: Long): Long {
        return when (val result = commands.rejectDraft(quizId)) {
            is QuizCommandResult.Success -> result.quizId
            is QuizCommandResult.Failure ->
                throw AdminQuizApplicationException(
                    code = "quiz_not_found",
                    message = "Quiz draft was not found.",
                )
        }
    }

    private fun QuizCommandResult.requireSuccess(): QuizCommandResult.Success =
        when (this) {
            is QuizCommandResult.Success -> this
            is QuizCommandResult.Failure ->
                when (reason) {
                    QuizCommandFailure.NOT_FOUND ->
                        throw AdminQuizApplicationException(
                            code = "quiz_not_found",
                            message = "Quiz was not found.",
                        )
                    QuizCommandFailure.NOT_EDITABLE ->
                        throw AdminQuizApplicationException(
                            code = "quiz_not_editable",
                            message = "Quiz is not an editable draft.",
                        )
                    QuizCommandFailure.INVALID_REVISION_TARGET ->
                        throw AdminQuizApplicationException(
                            code = "quiz_revision_invalid",
                            message = "Quiz revision target is not available.",
                        )
                }
        }
}

private const val MAX_GENERATION_ROUNDS = 3
private const val MAX_RETRY_EXCLUSIONS = 40
private const val MAX_RETRY_EXCLUSION_LENGTH = 200

private fun learningTargetIdentity(content: QuizContent): String =
    listOf(
        content.quizType.databaseValue,
        content.tag.databaseValue,
        content.learningTarget().digest,
    ).joinToString("\u001f")
