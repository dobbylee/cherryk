import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/contracts/auth";
import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import type { RecommendedQuiz } from "@/lib/contracts/quiz";
import type {
  QuizAttemptSummary,
  QuizRepository,
} from "@/server/repositories/quizRepository";
import { createQuizRecommendationService } from "./quizRecommendationService";

const testUser: AuthUser = {
  id: "66666666-6666-4666-8666-666666666666",
  displayName: "Friend",
  level: "beginner",
};

function createQuiz(index: number, tag: GrammarTag = "particle_object") {
  const suffix = String(index).padStart(12, "0");
  return {
    id: `10000000-0000-4000-8000-${suffix}`,
    tag,
    difficulty: "beginner" as const,
    questionEn: `Question ${index}`,
    sentenceKo: `문장 ${index}`,
    choices: [1, 2, 3, 4].map((choiceIndex) => ({
      id: `${choiceIndex}0000000-0000-4000-8000-${suffix}`,
      text: `Choice ${choiceIndex}`,
    })),
  } satisfies RecommendedQuiz;
}

function createSummary(
  quizId: string,
  input: Partial<Omit<QuizAttemptSummary, "quizId">> = {},
): QuizAttemptSummary {
  return {
    quizId,
    attemptCount: 1,
    correctCount: 0,
    lastAttemptCorrect: false,
    lastAttemptedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...input,
  };
}

function createRepository({
  quizzes = [createQuiz(1)],
  summaries = [],
  topTags = [],
}: {
  quizzes?: RecommendedQuiz[];
  summaries?: QuizAttemptSummary[];
  topTags?: GrammarTag[];
} = {}) {
  const requestedTags: GrammarTag[][] = [];
  const requestedUserIds: string[] = [];
  const repository: QuizRepository = {
    async findApprovedQuizzesByTags(tags) {
      requestedTags.push(tags);
      return quizzes;
    },
    async findQuizAttemptSummaries(userId) {
      requestedUserIds.push(userId);
      return summaries;
    },
    async findTopUserTags(userId) {
      requestedUserIds.push(userId);
      return topTags;
    },
    async createQuizDrafts() {
      throw new Error("Not used.");
    },
    async deleteQuizDraft() {
      throw new Error("Not used.");
    },
    async updateQuiz() {
      throw new Error("Not used.");
    },
    async recordQuizAttempt() {
      throw new Error("Not used.");
    },
  };

  return { repository, requestedTags, requestedUserIds };
}

describe("quizRecommendationService", () => {
  it("filters approved quizzes by unique requested tags and returns progress", async () => {
    const quiz = createQuiz(1);
    const summary = createSummary(quiz.id, {
      attemptCount: 3,
      correctCount: 2,
      lastAttemptCorrect: true,
    });
    const { repository, requestedTags, requestedUserIds } = createRepository({
      quizzes: [quiz],
      summaries: [summary],
    });
    const service = createQuizRecommendationService(repository, () => 0.5);

    await expect(
      service.recommendByTags(testUser, ["particle_object", "particle_object"]),
    ).resolves.toEqual({
      quizzes: [{ ...quiz, attemptCount: 3 }],
      availableTags: ["particle_object"],
      activeTags: ["particle_object"],
      progress: {
        solvedCount: 1,
        totalCount: 1,
        attemptCount: 3,
        correctCount: 2,
      },
    });
    expect(requestedTags).toEqual([[]]);
    expect(requestedUserIds).toEqual([testUser.id]);
    expect(quiz.choices[0]).not.toHaveProperty("isCorrect");
    expect(quiz).not.toHaveProperty("status");
  });

  it("returns at most five unseen questions before attempted questions", async () => {
    const quizzes = Array.from({ length: 7 }, (_, index) =>
      createQuiz(index + 1),
    );
    const summaries = [
      createSummary(quizzes[0].id, { attemptCount: 2 }),
      createSummary(quizzes[1].id, { attemptCount: 2 }),
    ];
    const randomValues = [0.9, 0.8, 0.5, 0.1, 0.4, 0.2, 0.3];
    const { repository } = createRepository({ quizzes, summaries });
    const service = createQuizRecommendationService(
      repository,
      () => randomValues.shift() ?? 0,
    );

    const result = await service.recommendByTags(testUser, []);

    expect(result.quizzes.map((quiz) => quiz.id)).toEqual([
      quizzes[3].id,
      quizzes[5].id,
      quizzes[6].id,
      quizzes[4].id,
      quizzes[2].id,
    ]);
    expect(result.quizzes.every((quiz) => quiz.attemptCount === 0)).toBe(true);
  });

  it("fills review sets by recent error, low accuracy, fewer attempts, and older activity", async () => {
    const quizzes = Array.from({ length: 6 }, (_, index) =>
      createQuiz(index + 1),
    );
    const summaries = [
      createSummary(quizzes[0].id, {
        attemptCount: 4,
        correctCount: 1,
        lastAttemptCorrect: true,
      }),
      createSummary(quizzes[1].id, {
        attemptCount: 4,
        correctCount: 1,
        lastAttemptCorrect: false,
      }),
      createSummary(quizzes[2].id, {
        attemptCount: 3,
        correctCount: 1,
        lastAttemptCorrect: false,
      }),
      createSummary(quizzes[3].id, {
        attemptCount: 6,
        correctCount: 2,
        lastAttemptCorrect: false,
      }),
      createSummary(quizzes[4].id, {
        attemptCount: 3,
        correctCount: 1,
        lastAttemptCorrect: false,
        lastAttemptedAt: new Date("2026-07-18T00:00:00.000Z"),
      }),
      createSummary(quizzes[5].id, {
        attemptCount: 3,
        correctCount: 1,
        lastAttemptCorrect: false,
        lastAttemptedAt: new Date("2026-07-19T00:00:00.000Z"),
      }),
    ];
    const { repository } = createRepository({ quizzes, summaries });
    const service = createQuizRecommendationService(repository, () => 0.5);

    const result = await service.recommendByTags(testUser, []);

    expect(result.quizzes.map((quiz) => quiz.id)).toEqual([
      quizzes[1].id,
      quizzes[4].id,
      quizzes[5].id,
      quizzes[2].id,
      quizzes[3].id,
    ]);
  });

  it("excludes attempts for quizzes that are no longer approved from progress", async () => {
    const quiz = createQuiz(1);
    const { repository } = createRepository({
      quizzes: [quiz],
      summaries: [
        createSummary(quiz.id, { attemptCount: 2, correctCount: 1 }),
        createSummary("99999999-9999-4999-8999-999999999999", {
          attemptCount: 10,
          correctCount: 10,
        }),
      ],
    });
    const service = createQuizRecommendationService(repository, () => 0.5);

    await expect(service.recommendByTags(testUser, [])).resolves.toMatchObject({
      progress: {
        solvedCount: 1,
        totalCount: 1,
        attemptCount: 2,
        correctCount: 1,
      },
    });
  });

  it("rejects repository output with incomplete choices before it reaches users", async () => {
    const quiz = createQuiz(1);
    const { repository } = createRepository({
      quizzes: [{ ...quiz, choices: quiz.choices.slice(0, 3) }],
    });
    const service = createQuizRecommendationService(repository, () => 0.5);

    await expect(
      service.recommendByTags(testUser, ["particle_object"]),
    ).rejects.toThrow();
  });

  it("falls back to top user tags when no tags are requested", async () => {
    const quiz = createQuiz(1);
    const { repository, requestedUserIds } = createRepository({
      quizzes: [quiz],
      topTags: ["particle_object", "particle_object", "spacing"],
    });
    const service = createQuizRecommendationService(repository, () => 0.5);

    await expect(
      service.recommendByTags(testUser, null),
    ).resolves.toMatchObject({
      quizzes: [{ ...quiz, attemptCount: 0 }],
      availableTags: ["particle_object"],
      activeTags: ["particle_object"],
    });
    expect(requestedUserIds).toEqual([testUser.id, testUser.id]);
  });

  it("returns all approved quizzes when an explicit empty tag list is requested", async () => {
    const { repository } = createRepository();
    const service = createQuizRecommendationService(repository, () => 0.5);

    await expect(service.recommendByTags(testUser, [])).resolves.toMatchObject({
      availableTags: ["particle_object"],
      activeTags: [],
    });
  });

  it("falls back to all approved quizzes when requested tags have no matches", async () => {
    const { repository } = createRepository();
    const service = createQuizRecommendationService(repository, () => 0.5);

    await expect(
      service.recommendByTags(testUser, ["spacing"]),
    ).resolves.toMatchObject({
      availableTags: ["particle_object"],
      activeTags: [],
    });
  });
});
