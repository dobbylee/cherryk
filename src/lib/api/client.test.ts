import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson, fetchNoContent } from "./client";

describe("fetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sets JSON content type for JSON request bodies", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("Content-Type")).toBe("application/json");
        return Response.json({ ok: true });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchJson<{ ok: boolean }>("/api/test", {
      method: "POST",
      body: JSON.stringify({ ok: true }),
    });
  });

  it("does not force content type for FormData request bodies", async () => {
    const body = new FormData();
    body.set("image", new Blob(["test"]), "test.png");

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.has("Content-Type")).toBe(false);
        return Response.json({ ok: true });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await fetchJson<{ ok: boolean }>("/api/v1/ocr/extract", {
      method: "POST",
      body,
    });
  });

  it("throws API error messages when present", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "invalid_request",
              message: "Correction request is invalid.",
            },
          },
          { status: 400 },
        ),
      ),
    );

    await expect(fetchJson("/api/test")).rejects.toThrow(
      "Correction request is invalid.",
    );
  });

  it("sends the readable CSRF cookie on state-changing requests", async () => {
    vi.stubGlobal("document", {
      cookie: "other=value; XSRF-TOKEN=csrf%2Dtoken",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-token");
        return new Response(null, { status: 204 });
      }),
    );

    await fetchNoContent("/api/auth/logout", { method: "POST" });
  });

  it("does not send a CSRF header on safe requests", async () => {
    vi.stubGlobal("document", { cookie: "XSRF-TOKEN=csrf-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const headers = new Headers(init?.headers);
        expect(headers.has("X-XSRF-TOKEN")).toBe(false);
        return Response.json({ ok: true });
      }),
    );

    await fetchJson<{ ok: boolean }>("/api/test");
  });
});
