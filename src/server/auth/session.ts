import { createHmac, randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "cherryk_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;

type CookieSameSite = "lax" | "strict" | "none";

export type SessionCookieOptions = {
  httpOnly: true;
  sameSite: CookieSameSite;
  secure: boolean;
  path: "/";
  expires: Date;
};

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function createSessionExpiresAt(
  now = new Date(),
  ttlMs = SESSION_TTL_MS,
) {
  return new Date(now.getTime() + ttlMs);
}

export function requireAuthSecret(authSecret = process.env.AUTH_SECRET) {
  if (!authSecret) {
    throw new Error("AUTH_SECRET is required.");
  }

  return authSecret;
}

export function hashInviteCode(inviteCode: string, authSecret?: string) {
  return hashAuthValue(`invite:${inviteCode.trim()}`, authSecret);
}

export function hashSessionToken(sessionToken: string, authSecret?: string) {
  return hashAuthValue(`session:${sessionToken}`, authSecret);
}

export function readSessionTokenFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");
    if (rawName === SESSION_COOKIE_NAME) {
      const rawValue = rawValueParts.join("=");
      try {
        return rawValue ? decodeURIComponent(rawValue) : null;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function sessionCookieOptions(expiresAt: Date): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function expiredSessionCookieOptions(): SessionCookieOptions {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  };
}

function hashAuthValue(value: string, authSecret?: string) {
  return createHmac("sha256", requireAuthSecret(authSecret))
    .update(value)
    .digest("hex");
}
