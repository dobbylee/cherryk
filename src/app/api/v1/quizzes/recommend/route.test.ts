import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/contracts/auth";
import { GrammarTags } from "@/lib/contracts/grammar-tags";
import { AuthServiceError } from "@/server/services/authService";
import { GET } from "./route";

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
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Friend",
  level: "beginner",
};

describe("GET /api/v1/quizzes/recommend", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCurrentUser.mockResolvedValue(testUser);
  });

  it("returns recommended quizzes with public fields only", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async findApprovedQuizzesByTags(tags: string[]) {
        expect(tags).toEqual(["particle_object", "spacing"]);
        return [
          {
            id: "22222222-2222-4222-8222-222222222222",
            tag: "particle_object",
            difficulty: "beginner",
            status: "approved",
            questionEn: "Choose the correct particle.",
            sentenceKo: "저는 사과( ) 먹어요.",
            answerExplanationEn:
              "Use 를 because 사과 is the direct object of 먹어요.",
            choices: [
              {
                id: "33333333-3333-4333-8333-333333333333",
                text: "은",
                isCorrect: false,
              },
              {
                id: "44444444-4444-4444-8444-444444444444",
                text: "를",
                isCorrect: true,
              },
              {
                id: "55555555-5555-4555-8555-555555555555",
                text: "에",
                isCorrect: false,
              },
              {
                id: "66666666-6666-4666-8666-666666666666",
                text: "이",
                isCorrect: false,
              },
            ],
          },
        ];
      },
    });

    const response = await GET(
      new Request(
        "http://localhost/api/v1/quizzes/recommend?tags=particle_object,spacing",
      ),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      quizzes: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          tag: "particle_object",
          difficulty: "beginner",
          questionEn: "Choose the correct particle.",
          sentenceKo: "저는 사과( ) 먹어요.",
          choices: [
            { id: "33333333-3333-4333-8333-333333333333", text: "은" },
            { id: "44444444-4444-4444-8444-444444444444", text: "를" },
            { id: "55555555-5555-4555-8555-555555555555", text: "에" },
            { id: "66666666-6666-4666-8666-666666666666", text: "이" },
          ],
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain("isCorrect");
    expect(JSON.stringify(payload)).not.toContain("answerExplanationEn");
    expect(JSON.stringify(payload)).not.toContain("status");
  });

  it("rejects invalid tags before querying quizzes", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/quizzes/recommend?tags=not_allowed"),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "invalid_request",
        message: "Quiz recommendation query is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("accepts the full v1 grammar tag set", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async findApprovedQuizzesByTags(tags: string[]) {
        expect(tags).toEqual(GrammarTags);
        return [];
      },
    });

    const response = await GET(
      new Request(
        `http://localhost/api/v1/quizzes/recommend?tags=${GrammarTags.join(",")}`,
      ),
    );

    expect(response.status).toBe(200);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mocks.requireCurrentUser.mockRejectedValue(
      new AuthServiceError("unauthorized", "Authentication required."),
    );

    const response = await GET(
      new Request(
        "http://localhost/api/v1/quizzes/recommend?tags=particle_object",
      ),
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
});
