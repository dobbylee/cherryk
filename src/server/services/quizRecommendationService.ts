import type { AuthUser } from "@/lib/contracts/auth";
import {
  GrammarTags,
  type GrammarTag,
} from "@/lib/contracts/grammar-tags";
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
      const requestedTags = Array.from(
        new Set(
          tags === null ? await repository.findTopUserTags(user.id) : tags,
        ),
      );
      const approvedQuizzes = await repository.findApprovedQuizzesByTags([]);
      const availableTagSet = new Set(
        approvedQuizzes.map((quiz) => quiz.tag),
      );
      const availableTags = GrammarTags.filter((tag) =>
        availableTagSet.has(tag),
      );
      const activeTags = requestedTags.filter((tag) =>
        availableTagSet.has(tag),
      );
      const matchingQuizzes = approvedQuizzes.filter((quiz) =>
        activeTags.includes(quiz.tag),
      );
      const quizzes = matchingQuizzes.length
        ? matchingQuizzes
        : approvedQuizzes;

      return QuizRecommendationResponseSchema.parse({
        quizzes,
        availableTags,
        activeTags: matchingQuizzes.length ? activeTags : [],
      });
    },
  };
}
