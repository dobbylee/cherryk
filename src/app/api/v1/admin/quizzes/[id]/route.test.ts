import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECRET_HEADER } from "@/server/auth/admin";
import { DELETE, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(() => ({})),
  createQuizRepository: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/server/repositories/quizRepository", () => ({
  createQuizRepository: mocks.createQuizRepository,
}));

const routeContext = {
  params: Promise.resolve({
    id: "11111111-1111-4111-8111-111111111111",
  }),
};

describe("/api/v1/admin/quizzes/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("updates quiz review status for admin users", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async updateQuiz(input: {
        id: string;
        update: { status?: string };
      }) {
        expect(input).toMatchObject({
          id: "11111111-1111-4111-8111-111111111111",
          update: {
            status: "approved",
          },
        });
        return {
          id: input.id,
          status: "approved",
        };
      },
      async createQuizDrafts() {
        throw new Error("Not used.");
      },
      async findApprovedQuizzesByTags() {
        throw new Error("Not used.");
      },
    });

    const response = await PATCH(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: {
            [ADMIN_SECRET_HEADER]: "test-admin-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "approved",
          }),
        },
      ),
      routeContext,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      quiz: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "approved",
      },
    });
  });

  it("deletes a rejected draft for admin users", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async deleteQuizDraft(id: string) {
        expect(id).toBe("11111111-1111-4111-8111-111111111111");
        return true;
      },
    });

    const response = await DELETE(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "DELETE",
          headers: {
            [ADMIN_SECRET_HEADER]: "test-admin-secret",
          },
        },
      ),
      routeContext,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      deletedQuizId: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("does not delete approved or missing quizzes", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async deleteQuizDraft() {
        return false;
      },
    });

    const response = await DELETE(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "DELETE",
          headers: {
            [ADMIN_SECRET_HEADER]: "test-admin-secret",
          },
        },
      ),
      routeContext,
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "quiz_not_found",
        message: "Quiz draft was not found.",
      },
    });
  });

  it("rejects draft deletion without the admin secret", async () => {
    const response = await DELETE(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        { method: "DELETE" },
      ),
      routeContext,
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "unauthorized",
        message: "Admin secret is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("rejects invalid quiz ids before draft deletion", async () => {
    const response = await DELETE(
      new Request("http://localhost/api/v1/admin/quizzes/not-a-uuid", {
        method: "DELETE",
        headers: {
          [ADMIN_SECRET_HEADER]: "test-admin-secret",
        },
      }),
      { params: Promise.resolve({ id: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "invalid_request",
        message: "Quiz id is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("rejects requests without the admin secret before creating the repository", async () => {
    const response = await PATCH(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "approved",
          }),
        },
      ),
      routeContext,
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

  it("rejects invalid quiz updates before creating the repository", async () => {
    const response = await PATCH(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: {
            [ADMIN_SECRET_HEADER]: "test-admin-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            choices: [
              { text: "은", isCorrect: false, sortOrder: 0 },
              { text: "를", isCorrect: true, sortOrder: 1 },
              { text: "에", isCorrect: true, sortOrder: 2 },
              { text: "이", isCorrect: false, sortOrder: 3 },
            ],
          }),
        },
      ),
      routeContext,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "invalid_request",
        message: "Quiz update request is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("rejects invalid quiz ids before creating the repository", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/v1/admin/quizzes/not-a-uuid", {
        method: "PATCH",
        headers: {
          [ADMIN_SECRET_HEADER]: "test-admin-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "approved",
        }),
      }),
      {
        params: Promise.resolve({
          id: "not-a-uuid",
        }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload).toEqual({
      error: {
        code: "invalid_request",
        message: "Quiz id is invalid.",
      },
    });
    expect(mocks.createQuizRepository).not.toHaveBeenCalled();
  });

  it("returns 404 when the quiz does not exist", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async updateQuiz() {
        return null;
      },
      async createQuizDrafts() {
        throw new Error("Not used.");
      },
      async findApprovedQuizzesByTags() {
        throw new Error("Not used.");
      },
    });

    const response = await PATCH(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: {
            [ADMIN_SECRET_HEADER]: "test-admin-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status: "approved",
          }),
        },
      ),
      routeContext,
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload).toEqual({
      error: {
        code: "quiz_not_found",
        message: "Quiz was not found.",
      },
    });
  });

  it("returns 409 when attempts already reference choices", async () => {
    mocks.createQuizRepository.mockReturnValue({
      async updateQuiz() {
        return { code: "quiz_choices_locked" };
      },
      async createQuizDrafts() {
        throw new Error("Not used.");
      },
      async findApprovedQuizzesByTags() {
        throw new Error("Not used.");
      },
    });

    const response = await PATCH(
      new Request(
        "http://localhost/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        {
          method: "PATCH",
          headers: {
            [ADMIN_SECRET_HEADER]: "test-admin-secret",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            choices: [
              { text: "은", isCorrect: false, sortOrder: 0 },
              { text: "를", isCorrect: true, sortOrder: 1 },
              { text: "에", isCorrect: false, sortOrder: 2 },
              { text: "이", isCorrect: false, sortOrder: 3 },
            ],
          }),
        },
      ),
      routeContext,
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload).toEqual({
      error: {
        code: "quiz_choices_locked",
        message: "Quiz choices cannot be replaced after attempts exist.",
      },
    });
  });
});
