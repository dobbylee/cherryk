import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { createMaintenanceProxy } from "./proxy";

const BYPASS_TOKEN = "test-maintenance-token-with-32-characters";

describe("Production maintenance proxy", () => {
  it("does nothing when write-frozen mode is disabled", async () => {
    const response = await invoke("/api/v1/corrections", "POST", {
      mode: undefined,
      bypassToken: undefined,
    });

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"])(
    "blocks public %s API requests in write-frozen mode",
    async (method) => {
      const response = await invoke("/api/v1/quizzes/recommend", method);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: {
          code: "maintenance",
          message: "CherryK is temporarily read-only.",
        },
      });
      expect(response.headers.get("retry-after")).toBe("300");
      expect(response.headers.get("cache-control")).toBe("no-store");
    },
  );

  it.each(["/api/auth", "/api/auth/callback/google"])(
    "blocks the complete auth flow at %s because reads can write session state",
    async (path) => {
      const response = await invoke(path, "GET");

      expect(response.status).toBe(503);
    },
  );

  it("allows paths outside the protected API trees", async () => {
    const response = await invoke("/api/maintenance/status", "GET");

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("fails closed when the bypass token is missing or too short", async () => {
    const missingTokenResponse = await invoke(
      "/api/v1/corrections",
      "POST",
      { mode: "write-frozen", bypassToken: undefined },
      { "x-cherryk-maintenance-bypass": BYPASS_TOKEN },
    );
    const shortTokenResponse = await invoke(
      "/api/v1/corrections",
      "POST",
      { mode: "write-frozen", bypassToken: "too-short" },
      { "x-cherryk-maintenance-bypass": "too-short" },
    );

    expect(missingTokenResponse.status).toBe(503);
    expect(shortTokenResponse.status).toBe(503);
  });

  it("allows an operator header without setting a cookie", async () => {
    const response = await invoke("/api/v1/corrections", "POST", undefined, {
      "x-cherryk-maintenance-bypass": BYPASS_TOKEN,
    });

    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("mints and accepts an HttpOnly operator cookie", async () => {
    const accessResponse = await invoke(
      "/api/maintenance/bypass",
      "POST",
      undefined,
      { "x-cherryk-maintenance-bypass": BYPASS_TOKEN },
    );
    const expectedDigest = createHash("sha256")
      .update(BYPASS_TOKEN)
      .digest("base64url");

    expect(accessResponse.status).toBe(204);
    expect(accessResponse.cookies.get("CHERRYK_MAINTENANCE_BYPASS")).toEqual(
      expect.objectContaining({ value: expectedDigest }),
    );
    expect(accessResponse.headers.get("set-cookie")).toContain("HttpOnly");
    expect(accessResponse.headers.get("set-cookie")).toContain("Secure");
    expect(accessResponse.headers.get("set-cookie")).toContain("SameSite=lax");

    const writeResponse = await invoke(
      "/api/v1/corrections",
      "POST",
      undefined,
      undefined,
      `CHERRYK_MAINTENANCE_BYPASS=${expectedDigest}`,
    );

    expect(writeResponse.headers.get("x-middleware-next")).toBe("1");
  });

  it("rejects invalid bypass access and clears an existing cookie", async () => {
    const invalidResponse = await invoke(
      "/api/maintenance/bypass",
      "POST",
      undefined,
      { "x-cherryk-maintenance-bypass": "invalid-token-value" },
    );
    const clearResponse = await invoke("/api/maintenance/bypass", "DELETE");

    expect(invalidResponse.status).toBe(403);
    expect(clearResponse.status).toBe(204);
    expect(clearResponse.headers.get("set-cookie")).toContain(
      "CHERRYK_MAINTENANCE_BYPASS=",
    );
    expect(clearResponse.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

async function invoke(
  path: string,
  method: string,
  environment: {
    mode: string | undefined;
    bypassToken: string | undefined;
  } = {
    mode: "write-frozen",
    bypassToken: BYPASS_TOKEN,
  },
  headers?: Record<string, string>,
  cookie?: string,
) {
  const requestHeaders = new Headers(headers);
  if (cookie) {
    requestHeaders.set("cookie", cookie);
  }
  const request = new NextRequest(`https://cherryk.kr${path}`, {
    method,
    headers: requestHeaders,
  });

  return createMaintenanceProxy(environment)(request);
}
