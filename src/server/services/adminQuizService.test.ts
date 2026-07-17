import { describe, expect, it } from "vitest";
import type { AIProvider } from "@/server/ai/provider";
import type {
  CreateQuizDraftsInput,
  QuizRepository,
  UpdateQuizInput,
} from "@/server/repositories/quizRepository";
import {
  AdminQuizServiceError,
  createAdminQuizService,
} from "./adminQuizService";

const draftQuestion = {
  tag: "particle_object" as const,
  difficulty: "beginner" as const,
  questionEn: "Choose the correct particle.",
  sentenceKo: "저는 사과( ) 먹어요.",
  choices: [
    { text: "은", isCorrect: false },
    { text: "를", isCorrect: true },
    { text: "에", isCorrect: false },
    { text: "이", isCorrect: false },
  ],
  answerExplanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
};

function createFakeRepository(): QuizRepository & {
  draftInput: CreateQuizDraftsInput | null;
  deletedQuizId: string | null;
  deleteResult: boolean;
  updateInput: UpdateQuizInput | null;
  updateResult: Awaited<ReturnType<QuizRepository["updateQuiz"]>>;
} {
  const repository: QuizRepository & {
    draftInput: CreateQuizDraftsInput | null;
    deletedQuizId: string | null;
    deleteResult: boolean;
    updateInput: UpdateQuizInput | null;
    updateResult: Awaited<ReturnType<QuizRepository["updateQuiz"]>>;
  } = {
    draftInput: null,
    deletedQuizId: null,
    deleteResult: true,
    updateInput: null,
    updateResult: {
      id: "22222222-2222-4222-8222-222222222222",
      status: "approved",
    },
    async findApprovedQuizzesByTags() {
      return [];
    },
    async createQuizDrafts(input) {
      repository.draftInput = input;
      return [
        {
          id: "11111111-1111-4111-8111-111111111111",
          ...input.questions[0],
        },
      ];
    },
    async deleteQuizDraft(id) {
      repository.deletedQuizId = id;
      return repository.deleteResult;
    },
    async updateQuiz(input) {
      repository.updateInput = input;
      return repository.updateResult;
    },
    async recordQuizAttempt() {
      throw new Error("Not used.");
    },
    async findTopUserTags() {
      throw new Error("Not used.");
    },
  };

  return repository;
}

function createFakeAIProvider(output: unknown): AIProvider {
  return {
    async correctKorean() {
      throw new Error("Not used.");
    },
    async extractKoreanTextFromImage() {
      throw new Error("Not used.");
    },
    async generateQuizDrafts() {
      return output as never;
    },
  };
}

describe("adminQuizService", () => {
  it("validates AI quiz drafts before storing them", async () => {
    const repository = createFakeRepository();
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions: [draftQuestion] }),
    );

    await expect(
      service.generateDrafts({
        tag: "particle_object",
        difficulty: "beginner",
        count: 1,
      }),
    ).resolves.toEqual({
      drafts: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          ...draftQuestion,
        },
      ],
    });
    expect(repository.draftInput).toEqual({
      questions: [draftQuestion],
    });
  });

  it("rejects invalid AI quiz drafts before storing", async () => {
    const repository = createFakeRepository();
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({
        questions: [
          {
            ...draftQuestion,
            choices: draftQuestion.choices.map((choice) => ({
              ...choice,
              isCorrect: true,
            })),
          },
        ],
      }),
    );

    await expect(
      service.generateDrafts({
        tag: "particle_object",
        difficulty: "beginner",
        count: 1,
      }),
    ).rejects.toBeInstanceOf(AdminQuizServiceError);
    expect(repository.draftInput).toBeNull();
  });

  it("rejects drafts that do not match the requested tag and difficulty", async () => {
    const repository = createFakeRepository();
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({
        questions: [
          {
            ...draftQuestion,
            difficulty: "intermediate",
          },
        ],
      }),
    );

    await expect(
      service.generateDrafts({
        tag: "particle_object",
        difficulty: "beginner",
        count: 1,
      }),
    ).rejects.toBeInstanceOf(AdminQuizServiceError);
    expect(repository.draftInput).toBeNull();
  });

  it.each([
    { name: "empty", questions: [] },
    { name: "too few", questions: [draftQuestion] },
    {
      name: "too many",
      questions: [draftQuestion, draftQuestion, draftQuestion],
    },
  ])("rejects $name AI draft counts before storing", async ({ questions }) => {
    const repository = createFakeRepository();
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions }),
    );

    await expect(
      service.generateDrafts({
        tag: "particle_object",
        difficulty: "beginner",
        count: 2,
      }),
    ).rejects.toBeInstanceOf(AdminQuizServiceError);
    expect(repository.draftInput).toBeNull();
  });

  it("updates a quiz through the repository", async () => {
    const now = new Date("2026-07-09T00:00:00.000Z");
    const repository = createFakeRepository();
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions: [] }),
      { now: () => now },
    );

    await expect(
      service.updateQuiz("22222222-2222-4222-8222-222222222222", {
        status: "approved",
      }),
    ).resolves.toEqual({
      quiz: {
        id: "22222222-2222-4222-8222-222222222222",
        status: "approved",
      },
    });
    expect(repository.updateInput).toEqual({
      id: "22222222-2222-4222-8222-222222222222",
      update: {
        status: "approved",
      },
      now,
    });
  });

  it("deletes a rejected draft through the repository", async () => {
    const repository = createFakeRepository();
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions: [] }),
    );

    await expect(
      service.deleteDraft("22222222-2222-4222-8222-222222222222"),
    ).resolves.toEqual({
      deletedQuizId: "22222222-2222-4222-8222-222222222222",
    });
    expect(repository.deletedQuizId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );
  });

  it("raises quiz_not_found when a rejected draft cannot be deleted", async () => {
    const repository = createFakeRepository();
    repository.deleteResult = false;
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions: [] }),
    );

    await expect(
      service.deleteDraft("22222222-2222-4222-8222-222222222222"),
    ).rejects.toMatchObject({ code: "quiz_not_found" });
  });

  it("raises quiz_not_found when the repository cannot update the quiz", async () => {
    const repository = createFakeRepository();
    repository.updateResult = null;
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions: [] }),
    );

    await expect(
      service.updateQuiz("22222222-2222-4222-8222-222222222222", {
        status: "approved",
      }),
    ).rejects.toMatchObject({
      code: "quiz_not_found",
    });
  });

  it("raises quiz_choices_locked when attempts already reference choices", async () => {
    const repository = createFakeRepository();
    repository.updateResult = { code: "quiz_choices_locked" };
    const service = createAdminQuizService(
      repository,
      createFakeAIProvider({ questions: [] }),
    );

    await expect(
      service.updateQuiz("22222222-2222-4222-8222-222222222222", {
        choices: [
          { text: "은", isCorrect: false, sortOrder: 0 },
          { text: "를", isCorrect: true, sortOrder: 1 },
          { text: "에", isCorrect: false, sortOrder: 2 },
          { text: "이", isCorrect: false, sortOrder: 3 },
        ],
      }),
    ).rejects.toMatchObject({
      code: "quiz_choices_locked",
    });
  });
});
