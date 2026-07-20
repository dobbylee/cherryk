import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteAdminQuizDraft,
  generateAdminQuizDrafts,
  updateAdminQuiz,
} from "./adminQuizzes";

describe("admin quiz API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("generates quiz drafts with the current account session", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(input).toBe("/api/v1/admin/quizzes/generate-drafts");
        expect(init?.method).toBe("POST");
        expect([...headers.keys()]).toEqual(["content-type"]);
        expect(init?.body).toBe(
          JSON.stringify({
            tag: "particle_object",
            difficulty: "beginner",
            count: 2,
          }),
        );
        return Response.json({ drafts: [] });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      generateAdminQuizDrafts({
        tag: "particle_object",
        difficulty: "beginner",
        count: 2,
      }),
    ).resolves.toEqual({ drafts: [] });
  });

  it("updates a quiz with the current account session", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(input).toBe(
          "/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        );
        expect(init?.method).toBe("PATCH");
        expect([...headers.keys()]).toEqual(["content-type"]);
        expect(init?.body).toBe(
          JSON.stringify({
            status: "approved",
          }),
        );
        return Response.json({
          quiz: {
            id: "11111111-1111-4111-8111-111111111111",
            status: "approved",
          },
        });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      updateAdminQuiz("11111111-1111-4111-8111-111111111111", {
        status: "approved",
      }),
    ).resolves.toEqual({
      quiz: {
        id: "11111111-1111-4111-8111-111111111111",
        status: "approved",
      },
    });
  });

  it("deletes a rejected draft with the current account session", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(input).toBe(
          "/api/v1/admin/quizzes/11111111-1111-4111-8111-111111111111",
        );
        expect(init?.method).toBe("DELETE");
        expect([...headers.keys()]).toEqual([]);
        return Response.json({
          deletedQuizId: "11111111-1111-4111-8111-111111111111",
        });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      deleteAdminQuizDraft("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual({
      deletedQuizId: "11111111-1111-4111-8111-111111111111",
    });
  });
});
