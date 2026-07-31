import { describe, expect, it } from "vitest";
import { GrammarTags } from "./grammar-tags";
import {
  AdminQuizDeleteResponseSchema,
  AdminQuizDraftGenerationResponseSchema,
  QuizDraftInputSchema,
  AdminQuizUpdateRequestSchema,
  AdminQuizUpdateResponseSchema,
  QuizAttemptRequestSchema,
  QuizAttemptResponseSchema,
  QuizRecommendationQuerySchema,
  QuizRecommendationResponseSchema,
} from "./quiz";

describe("QuizDraftInputSchema", () => {
  it("rejects unbounded draft generation counts", () => {
    expect(
      QuizDraftInputSchema.safeParse({
        tag: "particle_object",
        difficulty: "beginner",
        count: 100,
      }).success,
    ).toBe(false);
  });
});

describe("QuizRecommendationQuerySchema", () => {
  it("accepts the full v1 grammar tag set", () => {
    expect(
      QuizRecommendationQuerySchema.safeParse({
        tags: GrammarTags,
      }).success,
    ).toBe(true);
  });
});

describe("QuizRecommendationResponseSchema", () => {
  it("requires valid approved and active tag lists", () => {
    expect(
      QuizRecommendationResponseSchema.safeParse({
        quizzes: [],
        availableTags: ["not_allowed"],
        activeTags: [],
        progress: {
          solvedCount: 0,
          totalCount: 0,
          attemptCount: 0,
          correctCount: 0,
        },
      }).success,
    ).toBe(false);
  });

  it("rejects impossible progress counts", () => {
    expect(
      QuizRecommendationResponseSchema.safeParse({
        quizzes: [],
        availableTags: [],
        activeTags: [],
        progress: {
          solvedCount: 2,
          totalCount: 1,
          attemptCount: 1,
          correctCount: 2,
        },
      }).success,
    ).toBe(false);
  });
});

describe("QuizAttemptRequestSchema", () => {
  it("requires positive decimal quiz and selected choice ids", () => {
    expect(
      QuizAttemptRequestSchema.safeParse({
        quizId: "not-an-id",
        selectedChoiceId: "33",
      }).success,
    ).toBe(false);
    expect(
      QuizAttemptRequestSchema.safeParse({
        quizId: "32",
        selectedChoiceId: "33333333-3333-4333-8333-333333333333",
      }).success,
    ).toBe(false);
  });
});

describe("AdminQuizUpdateRequestSchema", () => {
  it("rejects empty updates", () => {
    expect(AdminQuizUpdateRequestSchema.safeParse({}).success).toBe(false);
  });

  it("does not retain rejected quiz status", () => {
    expect(
      AdminQuizUpdateRequestSchema.safeParse({ status: "rejected" }).success,
    ).toBe(false);
  });

  it("requires exactly one correct choice when choices are updated", () => {
    expect(
      AdminQuizUpdateRequestSchema.safeParse({
        choices: [
          { text: "은", isCorrect: false, sortOrder: 0 },
          { text: "를", isCorrect: true, sortOrder: 1 },
          { text: "에", isCorrect: true, sortOrder: 2 },
          { text: "이", isCorrect: false, sortOrder: 3 },
        ],
      }).success,
    ).toBe(false);
  });

  it("requires unique choice sort orders", () => {
    expect(
      AdminQuizUpdateRequestSchema.safeParse({
        choices: [
          { text: "은", isCorrect: false, sortOrder: 0 },
          { text: "를", isCorrect: true, sortOrder: 0 },
          { text: "에", isCorrect: false, sortOrder: 2 },
          { text: "이", isCorrect: false, sortOrder: 3 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects choice sort orders outside zero through three", () => {
    expect(
      AdminQuizUpdateRequestSchema.safeParse({
        choices: [
          { text: "은", isCorrect: false, sortOrder: 0 },
          { text: "를", isCorrect: true, sortOrder: 1 },
          { text: "에", isCorrect: false, sortOrder: 2 },
          { text: "이", isCorrect: false, sortOrder: 4 },
        ],
      }).success,
    ).toBe(false);
  });

  it("rejects unknown choice fields", () => {
    ["id", "legacyId"].forEach((unknownField) => {
      expect(
        AdminQuizUpdateRequestSchema.safeParse({
          choices: [
            {
              [unknownField]: "101",
              text: "은",
              isCorrect: false,
              sortOrder: 0,
            },
            {
              text: "를",
              isCorrect: true,
              sortOrder: 1,
            },
            { text: "에", isCorrect: false, sortOrder: 2 },
            { text: "이", isCorrect: false, sortOrder: 3 },
          ],
        }).success,
      ).toBe(false);
    });
  });
});

describe("Spring admin quiz entity ids", () => {
  it("accepts opaque BIGINT strings in admin responses and updates", () => {
    expect(
      AdminQuizDraftGenerationResponseSchema.safeParse({
        drafts: [
          {
            id: "42",
            tag: "particle_object",
            difficulty: "beginner",
            questionEn: "Choose the correct particle.",
            sentenceKo: "저는 사과( ) 먹어요.",
            choices: [
              { text: "은", isCorrect: false },
              { text: "를", isCorrect: true },
              { text: "에", isCorrect: false },
              { text: "이", isCorrect: false },
            ],
            answerExplanationEn: "Use 를.",
          },
        ],
      }).success,
    ).toBe(true);
    expect(
      AdminQuizUpdateRequestSchema.safeParse({
        choices: [
          { text: "은", isCorrect: false, sortOrder: 0 },
          { text: "를", isCorrect: true, sortOrder: 1 },
          { text: "에", isCorrect: false, sortOrder: 2 },
          { text: "이", isCorrect: false, sortOrder: 3 },
        ],
      }).success,
    ).toBe(true);
    expect(
      AdminQuizUpdateResponseSchema.safeParse({
        quiz: { id: "42", status: "approved" },
      }).success,
    ).toBe(true);
    expect(
      AdminQuizDeleteResponseSchema.safeParse({ deletedQuizId: "42" }).success,
    ).toBe(true);
  });

  it("rejects draft responses without exactly one correct choice", () => {
    expect(
      AdminQuizDraftGenerationResponseSchema.safeParse({
        drafts: [
          {
            id: "42",
            tag: "particle_object",
            difficulty: "beginner",
            questionEn: "Choose the correct particle.",
            sentenceKo: "저는 사과( ) 먹어요.",
            choices: [
              { text: "은", isCorrect: false },
              { text: "를", isCorrect: true },
              { text: "에", isCorrect: true },
              { text: "이", isCorrect: false },
            ],
            answerExplanationEn: "Use 를.",
          },
        ],
      }).success,
    ).toBe(false);
  });
});

describe("Spring quiz practice entity ids", () => {
  it("accepts opaque BIGINT strings for recommendations and attempts", () => {
    expect(
      QuizRecommendationResponseSchema.safeParse({
        quizzes: [
          {
            id: "42",
            tag: "particle_object",
            difficulty: "beginner",
            questionEn: "Choose.",
            sentenceKo: "저는 물( ) 마셔요.",
            choices: [
              { id: "101", text: "은" },
              { id: "102", text: "을" },
              { id: "103", text: "에" },
              { id: "104", text: "이" },
            ],
            attemptCount: 0,
          },
        ],
        availableTags: ["particle_object"],
        activeTags: ["particle_object"],
        progress: {
          solvedCount: 0,
          totalCount: 1,
          attemptCount: 0,
          correctCount: 0,
        },
      }).success,
    ).toBe(true);
    expect(
      QuizAttemptRequestSchema.safeParse({
        quizId: "42",
        selectedChoiceId: "102",
      }).success,
    ).toBe(true);
    expect(
      QuizAttemptResponseSchema.safeParse({
        isCorrect: true,
        correctChoiceId: "102",
        explanationEn: "Use 을.",
      }).success,
    ).toBe(true);
  });
});
