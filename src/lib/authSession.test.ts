import { describe, expect, it } from "vitest";
import { resolveAuthSession } from "./authSession";

describe("resolveAuthSession", () => {
  it("distinguishes authenticated and signed-out responses", async () => {
    const user = {
      id: "1",
      displayName: "Learner",
      level: "beginner" as const,
    };

    await expect(resolveAuthSession(async () => ({ user }))).resolves.toEqual({
      status: "authenticated",
      user,
    });
    await expect(
      resolveAuthSession(async () => ({ user: null })),
    ).resolves.toEqual({
      status: "signed-out",
      user: null,
    });
  });

  it("keeps authentication failures separate from signed-out state", async () => {
    await expect(
      resolveAuthSession(async () => {
        throw new Error("Do not expose transport details.");
      }),
    ).resolves.toEqual({
      status: "unavailable",
      user: null,
      message: "Authentication is unavailable.",
    });
  });
});
