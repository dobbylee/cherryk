import type { AuthUser } from "@/lib/contracts/auth";
import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import {
  QuizRecommendationResponseSchema,
  type QuizRecommendationResponse,
} from "@/lib/contracts/quiz";
import type { QuizRepository } from "@/server/repositories/quizRepository";

export function createQuizRecommendationService(repository: QuizRepository) {
  return {
    async recommendByTags(
      user: AuthUser,
      tags: GrammarTag[] | null,
    ): Promise<QuizRecommendationResponse> {
      const requestedTags =
        tags === null ? await repository.findTopUserTags(user.id) : tags;
      const quizzes = await repository.findApprovedQuizzesByTags(
        Array.from(new Set(requestedTags)),
      );

      return QuizRecommendationResponseSchema.parse({ quizzes });
    },
  };
}
