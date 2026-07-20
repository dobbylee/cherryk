import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_MS,
  SESSION_COOKIE_NAME,
  createInviteCode,
  createSessionExpiresAt,
  hashInviteCode,
  hashSessionToken,
  readSessionTokenFromRequest,
} from "./session";

describe("auth session helpers", () => {
  it("hashes invite codes and session tokens into different namespaces", () => {
    const secret = "test-secret";

    expect(hashInviteCode("local-invite-code", secret)).not.toBe(
      hashSessionToken("local-invite-code", secret),
    );
  });

  it("trims invite codes before hashing", () => {
    const secret = "test-secret";

    expect(hashInviteCode(" local-invite-code ", secret)).toBe(
      hashInviteCode("local-invite-code", secret),
    );
  });

  it("reads the session token from the cookie header", () => {
    const request = new Request("http://localhost/api/v1/auth/me", {
      headers: {
        cookie: `other=value; ${SESSION_COOKIE_NAME}=abc123`,
      },
    });

    expect(readSessionTokenFromRequest(request)).toBe("abc123");
  });

  it("treats malformed session cookie values as absent", () => {
    const request = new Request("http://localhost/api/v1/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=%`,
      },
    });

    expect(readSessionTokenFromRequest(request)).toBeNull();
  });

  it("creates session expiry from the supplied clock", () => {
    const now = new Date("2026-07-08T00:00:00.000Z");

    expect(createSessionExpiresAt(now, 1000).toISOString()).toBe(
      "2026-07-08T00:00:01.000Z",
    );
  });

  it("keeps signed-in sessions for 90 days by default", () => {
    const now = new Date("2026-07-08T00:00:00.000Z");

    expect(SESSION_TTL_MS).toBe(1000 * 60 * 60 * 24 * 90);
    expect(createSessionExpiresAt(now).toISOString()).toBe(
      "2026-10-06T00:00:00.000Z",
    );
  });

  it("creates high-entropy invite codes", () => {
    const firstCode = createInviteCode();
    const secondCode = createInviteCode();

    expect(firstCode).toHaveLength(43);
    expect(secondCode).toHaveLength(43);
    expect(firstCode).not.toBe(secondCode);
  });
});
