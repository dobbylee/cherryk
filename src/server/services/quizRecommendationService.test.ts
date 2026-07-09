import { describe, expect, it } from "vitest";
import type { RecommendedQuiz } from "@/lib/contracts/quiz";
import type { QuizRepository } from "@/server/repositories/quizRepository";
import { createQuizRecommendationService } from "./quizRecommendationService";

const recommendedQuiz: RecommendedQuiz = {
  id: "11111111-1111-4111-8111-111111111111",
  tag: "particle_object",
  difficulty: "beginner",
  questionEn: "Choose the correct particle.",
  sentenceKo: "저는 사과( ) 먹어요.",
  choices: [
    { id: "22222222-2222-4222-8222-222222222222", text: "은" },
    { id: "33333333-3333-4333-8333-333333333333", text: "를" },
    { id: "44444444-4444-4444-8444-444444444444", text: "에" },
    { id: "55555555-5555-4555-8555-555555555555", text: "이" },
  ],
};

describe("quizRecommendationService", () => {
  it("requests approved quizzes by unique tags and returns public quiz fields only", async () => {
    const requestedTags: string[][] = [];
    const repository: QuizRepository = {
      async findApprovedQuizzesByTags(tags) {
        requestedTags.push(tags);
        return [recommendedQuiz];
      },
      async createQuizDrafts() {
        throw new Error("Not used.");
      },
    };
    const service = createQuizRecommendationService(repository);

    await expect(
      service.recommendByTags(["particle_object", "particle_object"]),
    ).resolves.toEqual({
      quizzes: [recommendedQuiz],
    });
    expect(requestedTags).toEqual([["particle_object"]]);
    expect(recommendedQuiz.choices[0]).not.toHaveProperty("isCorrect");
    expect(recommendedQuiz).not.toHaveProperty("status");
  });

  it("rejects repository output with incomplete choices before it reaches users", async () => {
    const repository: QuizRepository = {
      async findApprovedQuizzesByTags() {
        return [
          {
            ...recommendedQuiz,
            choices: recommendedQuiz.choices.slice(0, 3),
          },
        ];
      },
      async createQuizDrafts() {
        throw new Error("Not used.");
      },
    };
    const service = createQuizRecommendationService(repository);

    await expect(service.recommendByTags(["particle_object"])).rejects.toThrow();
  });
});
