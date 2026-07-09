import { describe, expect, it } from "vitest";
import type { AIProvider } from "@/server/ai/provider";
import type {
  CreateQuizDraftsInput,
  QuizRepository,
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
} {
  const repository: QuizRepository & {
    draftInput: CreateQuizDraftsInput | null;
  } = {
    draftInput: null,
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
});
