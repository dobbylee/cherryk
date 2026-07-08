import { describe, expect, it } from "vitest";
import { InviteLoginRequestSchema } from "./auth";

describe("InviteLoginRequestSchema", () => {
  it("rejects an empty invite code", () => {
    expect(
      InviteLoginRequestSchema.safeParse({
        inviteCode: "   ",
      }).success,
    ).toBe(false);
  });

  it("rejects unbounded display names", () => {
    expect(
      InviteLoginRequestSchema.safeParse({
        inviteCode: "friend-dev-code",
        displayName: "a".repeat(81),
      }).success,
    ).toBe(false);
  });
});
