import { describe, expect, it } from "vitest";
import { GrammarTags } from "./grammar-tags";
import {
  QuizDraftInputSchema,
  QuizDraftOutputSchema,
  AdminQuizUpdateRequestSchema,
  QuizRecommendationQuerySchema,
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

describe("QuizDraftOutputSchema", () => {
  it("requires exactly one correct choice per question", () => {
    expect(
      QuizDraftOutputSchema.safeParse({
        questions: [
          {
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
            answerExplanationEn: "Use 를 for the direct object.",
          },
        ],
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

describe("AdminQuizUpdateRequestSchema", () => {
  it("rejects empty updates", () => {
    expect(AdminQuizUpdateRequestSchema.safeParse({}).success).toBe(false);
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

  it("requires unique defined choice ids", () => {
    expect(
      AdminQuizUpdateRequestSchema.safeParse({
        choices: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            text: "은",
            isCorrect: false,
            sortOrder: 0,
          },
          {
            id: "11111111-1111-4111-8111-111111111111",
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
