import { describe, expect, it } from "vitest";
import {
  SESSION_COOKIE_NAME,
  createSessionExpiresAt,
  hashInviteCode,
  hashSessionToken,
  readSessionTokenFromRequest,
} from "./session";

describe("auth session helpers", () => {
  it("hashes invite codes and session tokens into different namespaces", () => {
    const secret = "test-secret";

    expect(hashInviteCode("friend-dev-code", secret)).not.toBe(
      hashSessionToken("friend-dev-code", secret),
    );
  });

  it("trims invite codes before hashing", () => {
    const secret = "test-secret";

    expect(hashInviteCode(" friend-dev-code ", secret)).toBe(
      hashInviteCode("friend-dev-code", secret),
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
});
