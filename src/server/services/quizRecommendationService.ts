import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import {
  QuizRecommendationResponseSchema,
  type QuizRecommendationResponse,
} from "@/lib/contracts/quiz";
import type { QuizRepository } from "@/server/repositories/quizRepository";

export function createQuizRecommendationService(repository: QuizRepository) {
  return {
    async recommendByTags(
      tags: GrammarTag[],
    ): Promise<QuizRecommendationResponse> {
      const quizzes = await repository.findApprovedQuizzesByTags(
        Array.from(new Set(tags)),
      );

      return QuizRecommendationResponseSchema.parse({ quizzes });
    },
  };
}
