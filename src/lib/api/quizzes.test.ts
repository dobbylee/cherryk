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

  it("requests vocabulary recommendations separately", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      expect(input).toBe("/api/v1/quizzes/recommend?type=vocabulary");
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
      fetchQuizRecommendations(undefined, "vocabulary"),
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

  it("submits quiz attempts", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/api/v1/quizzes/attempt");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBe(
          JSON.stringify({
            quizId: "111",
            selectedChoiceId: "222",
          }),
        );
        return Response.json({
          isCorrect: true,
          correctChoiceId: "222",
          explanationEn: "Good choice.",
        });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      submitQuizAttempt({
        quizId: "111",
        selectedChoiceId: "222",
      }),
    ).resolves.toEqual({
      isCorrect: true,
      correctChoiceId: "222",
      explanationEn: "Good choice.",
    });
  });
});
