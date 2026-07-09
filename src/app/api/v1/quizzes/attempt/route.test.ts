import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/contracts/auth";
import { AuthServiceError } from "@/server/services/authService";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  requireCurrentUser: vi.fn(),
  createDb: vi.fn(() => ({})),
  createQuizRepository: vi.fn(),
}));

vi.mock("@/server/auth/currentUser", () => ({
  requireCurrentUser: mocks.requireCurrentUser,
}));

vi.mock("@/server/db", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/server/repositories/quizRepository", () => ({
  createQuizRepository: mocks.createQuizRepository,
}));

const testUser: AuthUser = {
  id: "44444444-4444-4444-8444-444444444444",
  displayName: "Friend",
  level: "beginner",
};

describe("POST /api/v1/quizzes/attempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue(testUser);
  });

  it("records an authenticated quiz attempt", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async recordQuizAttempt(input: {
        userId: string;
        quizId: string;
        selectedChoiceId: string;
      }) {
        expect(input).toEqual({
          userId: testUser.id,
          quizId: "11111111-1111-4111-8111-111111111111",
          selectedChoiceId: "33333333-3333-4333-8333-333333333333",
        });
        return {
          isCorrect: true,
          correctChoiceId: "33333333-3333-4333-8333-333333333333",
          explanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
        };
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
    });

    const response = await POST(
      new Request("http://localhost/api/v1/quizzes/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: "11111111-1111-4111-8111-111111111111",
          selectedChoiceId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      isCorrect: true,
      correctChoiceId: "33333333-3333-4333-8333-333333333333",
      explanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
    });
  });

  it("rejects invalid attempt requests before creating the repository", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/quizzes/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: "not-a-uuid",
          selectedChoiceId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "invalid_request",
        message: "Quiz attempt request is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.requireCurrentUser.mockRejectedValue(
      new AuthServiceError("unauthorized", "Authentication required."),
    );

    const response = await POST(
      new Request("http://localhost/api/v1/quizzes/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: "11111111-1111-4111-8111-111111111111",
          selectedChoiceId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      error: {
        code: "unauthorized",
        message: "Authentication required.",
      },
    });
  });

  it("returns 404 when the quiz is not available", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async recordQuizAttempt() {
        return null;
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
    });

    const response = await POST(
      new Request("http://localhost/api/v1/quizzes/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: "11111111-1111-4111-8111-111111111111",
          selectedChoiceId: "33333333-3333-4333-8333-333333333333",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        code: "quiz_not_available",
        message: "Quiz is not available.",
      },
    });
  });

  it("returns 400 when the selected choice is invalid", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async recordQuizAttempt() {
        return { code: "invalid_choice" };
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
    });

    const response = await POST(
      new Request("http://localhost/api/v1/quizzes/attempt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          quizId: "11111111-1111-4111-8111-111111111111",
          selectedChoiceId: "55555555-5555-4555-8555-555555555555",
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "invalid_choice",
        message: "Selected choice is invalid.",
      },
    });
  });
});
