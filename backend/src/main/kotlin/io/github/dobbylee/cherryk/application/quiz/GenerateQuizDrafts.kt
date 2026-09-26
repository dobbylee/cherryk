package io.github.dobbylee.cherryk.application.quiz

import io.github.dobbylee.cherryk.domain.quiz.QuizContent
import io.github.dobbylee.cherryk.domain.quiz.QuizType
import org.springframework.stereotype.Service
import java.time.Clock

@Service
class GenerateQuizDrafts(
    private val provider: QuizDraftProvider,
    private val commands: QuizCommandService,
    private val vocabularyTargets: VocabularyTargetRepository,
    private val outputGuard: QuizDraftOutputGuard,
    private val clock: Clock,
) {
    fun generateDrafts(request: AdminQuizDraftRequest): List<AdminQuizDraft> {
        val batch = QuizDraftCandidateBatch()
        val vocabularyClaims = mutableListOf<VocabularyTargetClaim>()

        return try {
            var generationRound = 0
            while (generationRound < MAX_GENERATION_ROUNDS) {
                generationRound += 1
                val remainingCount = request.count - batch.contents.size
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
                        avoidLearningTargets = batch.retryExclusions,
                    )
                val contents = generateContents(input)
                outputGuard.validate(contents, input)
                batch.addNovel(commands.findNovelDrafts(contents))
                batch.excludeGenerated(contents)
            }

            commands.createDrafts(batch.contents, clock.instant()).map { created ->
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
}

private const val MAX_GENERATION_ROUNDS = 3
