import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/contracts/auth";
import type {
  QuizRepository,
  RecordQuizAttemptInput,
} from "@/server/repositories/quizRepository";
import { createQuizAttemptService } from "./quizAttemptService";

const testUser: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  displayName: "Friend",
  level: "beginner",
};

function createFakeRepository(): QuizRepository & {
  attemptInput: RecordQuizAttemptInput | null;
  attemptResult: Awaited<ReturnType<QuizRepository["recordQuizAttempt"]>>;
} {
  const repository: QuizRepository & {
    attemptInput: RecordQuizAttemptInput | null;
    attemptResult: Awaited<ReturnType<QuizRepository["recordQuizAttempt"]>>;
  } = {
    attemptInput: null,
    attemptResult: {
      isCorrect: true,
      correctChoiceId: "33333333-3333-4333-8333-333333333333",
      explanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
    },
    async findApprovedQuizzesByTags() {
      throw new Error("Not used.");
    },
    async createQuizDrafts() {
      throw new Error("Not used.");
    },
    async updateQuiz() {
      throw new Error("Not used.");
    },
    async recordQuizAttempt(input) {
      repository.attemptInput = input;
      return repository.attemptResult;
    },
    async findTopUserTags() {
      throw new Error("Not used.");
    },
  };

  return repository;
}

describe("quizAttemptService", () => {
  it("records quiz attempts for the current user", async () => {
    const repository = createFakeRepository();
    const service = createQuizAttemptService(repository);

    await expect(
      service.submitAttempt(testUser, {
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "33333333-3333-4333-8333-333333333333",
      }),
    ).resolves.toEqual({
      isCorrect: true,
      correctChoiceId: "33333333-3333-4333-8333-333333333333",
      explanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
    });
    expect(repository.attemptInput).toEqual({
      userId: testUser.id,
      quizId: "11111111-1111-4111-8111-111111111111",
      selectedChoiceId: "33333333-3333-4333-8333-333333333333",
    });
  });

  it("raises quiz_not_available when the quiz cannot be attempted", async () => {
    const repository = createFakeRepository();
    repository.attemptResult = null;
    const service = createQuizAttemptService(repository);

    await expect(
      service.submitAttempt(testUser, {
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "33333333-3333-4333-8333-333333333333",
      }),
    ).rejects.toMatchObject({
      code: "quiz_not_available",
    });
  });

  it("raises invalid_choice when the selected choice is not part of the quiz", async () => {
    const repository = createFakeRepository();
    repository.attemptResult = { code: "invalid_choice" };
    const service = createQuizAttemptService(repository);

    await expect(
      service.submitAttempt(testUser, {
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "55555555-5555-4555-8555-555555555555",
      }),
    ).rejects.toMatchObject({
      code: "invalid_choice",
    });
  });
});
