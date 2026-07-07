import { describe, expect, it } from "vitest";
import { QuizDraftInputSchema, QuizDraftOutputSchema } from "./quiz";

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
