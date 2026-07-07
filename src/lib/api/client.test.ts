import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJson } from "./client";

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
});
