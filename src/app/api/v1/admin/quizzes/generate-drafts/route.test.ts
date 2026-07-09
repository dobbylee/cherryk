import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECRET_HEADER } from "@/server/auth/admin";
import { mockAIProvider } from "@/server/ai/mockAIProvider";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(() => ({})),
  createQuizRepository: vi.fn(),
  createAIProvider: vi.fn(() => mockAIProvider),
}));

vi.mock("@/server/ai/configuredProvider", () => ({
  createAIProvider: mocks.createAIProvider,
}));

vi.mock("@/server/db", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/server/repositories/quizRepository", () => ({
  createQuizRepository: mocks.createQuizRepository,
}));

describe("POST /api/v1/admin/quizzes/generate-drafts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates and stores draft quizzes for admin users", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async createQuizDrafts(input: {
        questions: {
          tag: string;
          difficulty: string;
          choices: { text: string; isCorrect: boolean }[];
        }[];
      }) {
        expect(input.questions).toHaveLength(2);
        expect(input.questions[0]).toMatchObject({
          tag: "particle_object",
          difficulty: "beginner",
        });
        return input.questions.map((question, index) => ({
          id:
            index === 0
              ? "11111111-1111-4111-8111-111111111111"
              : "22222222-2222-4222-8222-222222222222",
          ...question,
        }));
      },
      async findApprovedQuizzesByTags() {
        throw new Error("Not used.");
      },
    });

    const response = await POST(
      new Request("http://localhost/api/v1/admin/quizzes/generate-drafts", {
        method: "POST",
        headers: {
          [ADMIN_SECRET_HEADER]: "test-admin-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tag: "particle_object",
          difficulty: "beginner",
          count: 2,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.drafts).toHaveLength(2);
    expect(payload.drafts[0]).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      tag: "particle_object",
      difficulty: "beginner",
      questionEn: "Choose the correct particle.",
      sentenceKo: "저는 사과( ) 먹어요.",
    });
    expect(payload.drafts[0].choices).toEqual([
      { text: "은", isCorrect: false },
      { text: "를", isCorrect: true },
      { text: "에", isCorrect: false },
      { text: "이", isCorrect: false },
    ]);
  });

  it("rejects requests without the admin secret before creating the repository", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/admin/quizzes/generate-drafts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tag: "particle_object",
          difficulty: "beginner",
          count: 1,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      error: {
        code: "unauthorized",
        message: "Admin secret is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("rejects invalid draft requests before creating the repository", async () => {
    const response = await POST(
      new Request("http://localhost/api/v1/admin/quizzes/generate-drafts", {
        method: "POST",
        headers: {
          [ADMIN_SECRET_HEADER]: "test-admin-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tag: "not_allowed",
          difficulty: "beginner",
          count: 1,
        }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "invalid_request",
        message: "Quiz draft request is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });
});
