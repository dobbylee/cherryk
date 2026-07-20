import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/server/auth/auth", () => ({
  auth: {
    api: {
      getSession: mocks.getSession,
    },
  },
}));

import {
  AuthenticationError,
  getCurrentUser,
  requireCurrentUser,
} from "./currentUser";

const request = new Request("https://cherryk.example/api/v1/auth/me");

describe("current user auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps a Better Auth Google session to the public user contract", async () => {
    mocks.getSession.mockResolvedValue({
      session: { id: "session-id" },
      user: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Mina",
        email: "mina@example.com",
        level: "beginner",
      },
    });

    await expect(getCurrentUser(request)).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Mina",
      level: "beginner",
    });
    expect(mocks.getSession).toHaveBeenCalledWith({ headers: request.headers });
  });

  it("returns null for no session and rejects protected requests", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(getCurrentUser(request)).resolves.toBeNull();
    await expect(requireCurrentUser(request)).rejects.toBeInstanceOf(
      AuthenticationError,
    );
  });
});
