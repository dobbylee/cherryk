import type { AuthUser } from "@/lib/contracts/auth";
import {
  GrammarTags,
  type GrammarTag,
} from "@/lib/contracts/grammar-tags";
import {
  QuizRecommendationResponseSchema,
  type RecommendedQuiz,
  type QuizRecommendationResponse,
} from "@/lib/contracts/quiz";
import type {
  QuizAttemptSummary,
  QuizRepository,
} from "@/server/repositories/quizRepository";

const PRACTICE_SET_SIZE = 5;

export function createQuizRecommendationService(
  repository: QuizRepository,
  random: () => number = Math.random,
) {
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
      const [approvedQuizzes, attemptSummaries] = await Promise.all([
        repository.findApprovedQuizzesByTags([]),
        repository.findQuizAttemptSummaries(user.id),
      ]);
      const availableTagSet = new Set(approvedQuizzes.map((quiz) => quiz.tag));
      const availableTags = GrammarTags.filter((tag) =>
        availableTagSet.has(tag),
      );
      const activeTags = requestedTags.filter((tag) =>
        availableTagSet.has(tag),
      );
      const matchingQuizzes = approvedQuizzes.filter((quiz) =>
        activeTags.includes(quiz.tag),
      );
      const candidates = matchingQuizzes.length
        ? matchingQuizzes
        : approvedQuizzes;
      const approvedQuizIds = new Set(approvedQuizzes.map((quiz) => quiz.id));
      const approvedAttemptSummaries = attemptSummaries.filter((summary) =>
        approvedQuizIds.has(summary.quizId),
      );
      const attemptSummaryByQuizId = new Map(
        approvedAttemptSummaries.map((summary) => [summary.quizId, summary]),
      );
      const quizzes = selectPracticeSet(
        candidates,
        attemptSummaryByQuizId,
        random,
      );

      return QuizRecommendationResponseSchema.parse({
        quizzes,
        availableTags,
        activeTags: matchingQuizzes.length ? activeTags : [],
        progress: {
          solvedCount: approvedAttemptSummaries.length,
          totalCount: approvedQuizzes.length,
          attemptCount: approvedAttemptSummaries.reduce(
            (total, summary) => total + summary.attemptCount,
            0,
          ),
          correctCount: approvedAttemptSummaries.reduce(
            (total, summary) => total + summary.correctCount,
            0,
          ),
        },
      });
    },
  };
}

function selectPracticeSet(
  quizzes: RecommendedQuiz[],
  attemptSummaryByQuizId: Map<string, QuizAttemptSummary>,
  random: () => number,
) {
  return quizzes
    .map((quiz) => ({
      quiz,
      summary: attemptSummaryByQuizId.get(quiz.id),
      randomOrder: random(),
    }))
    .sort(comparePracticeCandidates)
    .slice(0, PRACTICE_SET_SIZE)
    .map(({ quiz, summary }) => ({
      ...quiz,
      attemptCount: summary?.attemptCount ?? 0,
    }));
}

function comparePracticeCandidates(
  left: {
    summary: QuizAttemptSummary | undefined;
    randomOrder: number;
  },
  right: {
    summary: QuizAttemptSummary | undefined;
    randomOrder: number;
  },
) {
  if (!left.summary || !right.summary) {
    if (!left.summary && !right.summary) {
      return left.randomOrder - right.randomOrder;
    }

    return left.summary ? 1 : -1;
  }

  if (left.summary.lastAttemptCorrect !== right.summary.lastAttemptCorrect) {
    return left.summary.lastAttemptCorrect ? 1 : -1;
  }

  const accuracyComparison =
    left.summary.correctCount * right.summary.attemptCount -
    right.summary.correctCount * left.summary.attemptCount;
  if (accuracyComparison !== 0) {
    return accuracyComparison;
  }

  if (left.summary.attemptCount !== right.summary.attemptCount) {
    return left.summary.attemptCount - right.summary.attemptCount;
  }

  const recencyComparison =
    left.summary.lastAttemptedAt.getTime() -
    right.summary.lastAttemptedAt.getTime();
  if (recencyComparison !== 0) {
    return recencyComparison;
  }

  return left.randomOrder - right.randomOrder;
}
