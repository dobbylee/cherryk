import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchQuizRecommendations, submitQuizAttempt } from "./quizzes";

describe("quiz API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches fallback recommendations when tags are omitted", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBe("/api/v1/quizzes/recommend");
      return Response.json({
        quizzes: [],
        availableTags: [],
        activeTags: [],
        progress: {
          solvedCount: 0,
          totalCount: 0,
          attemptCount: 0,
          correctCount: 0,
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchQuizRecommendations()).resolves.toEqual({
      quizzes: [],
      availableTags: [],
      activeTags: [],
      progress: {
        solvedCount: 0,
        totalCount: 0,
        attemptCount: 0,
        correctCount: 0,
      },
    });
  });

  it("fetches recommendations for explicit tags", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBe(
        "/api/v1/quizzes/recommend?tags=particle_object%2Cspacing",
      );
      return Response.json({
        quizzes: [],
        availableTags: [],
        activeTags: [],
        progress: {
          solvedCount: 0,
          totalCount: 0,
          attemptCount: 0,
          correctCount: 0,
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchQuizRecommendations(["particle_object", "spacing"]),
    ).resolves.toEqual({
      quizzes: [],
      availableTags: [],
      activeTags: [],
      progress: {
        solvedCount: 0,
        totalCount: 0,
        attemptCount: 0,
        correctCount: 0,
      },
    });
  });

  it("preserves explicit empty tag requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBe("/api/v1/quizzes/recommend?tags=");
      return Response.json({
        quizzes: [],
        availableTags: [],
        activeTags: [],
        progress: {
          solvedCount: 0,
          totalCount: 0,
          attemptCount: 0,
          correctCount: 0,
        },
      });
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchQuizRecommendations([])).resolves.toEqual({
      quizzes: [],
      availableTags: [],
      activeTags: [],
      progress: {
        solvedCount: 0,
        totalCount: 0,
        attemptCount: 0,
        correctCount: 0,
      },
    });
  });

  it("submits quiz attempts", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/api/v1/quizzes/attempt");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(
          JSON.stringify({
            quizId: "11111111-1111-4111-8111-111111111111",
            selectedChoiceId: "22222222-2222-4222-8222-222222222222",
          }),
        );
        return Response.json({
          isCorrect: true,
          correctChoiceId: "22222222-2222-4222-8222-222222222222",
          explanationEn: "Good choice.",
        });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitQuizAttempt({
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toEqual({
      isCorrect: true,
      correctChoiceId: "22222222-2222-4222-8222-222222222222",
      explanationEn: "Good choice.",
    });
  });
});
