import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  ApiContractError,
  ApiRequestError,
  fetchJson,
  fetchNoContent,
} from "./client";

const OkResponseSchema = z.object({ ok: z.boolean() });

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

    await fetchJson("/api/test", OkResponseSchema, {
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

    await fetchJson("/api/v1/ocr/extract", OkResponseSchema, {
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

    await expect(fetchJson("/api/test", OkResponseSchema)).rejects.toThrow(
      "Correction request is invalid.",
    );
  });

  it("preserves status and code for API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "invalid_request",
              message: "Request is invalid.",
            },
          },
          { status: 400 },
        ),
      ),
    );

    const error = await fetchJson("/api/test", OkResponseSchema).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      code: "invalid_request",
      message: "Request is invalid.",
      status: 400,
    });
  });

  it("uses the HTTP status when an error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () => new Response("<html>Bad gateway</html>", { status: 502 }),
      ),
    );

    const error = await fetchJson("/api/test", OkResponseSchema).catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      message: "Request failed with status 502",
      status: 502,
    });
  });

  it("rejects successful payloads that violate the response contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: "yes" })),
    );

    await expect(
      fetchJson("/api/test", OkResponseSchema),
    ).rejects.toBeInstanceOf(ApiContractError);
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

  it("preserves status and code for no-content API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          {
            error: {
              code: "forbidden",
              message: "Access is not allowed.",
            },
          },
          { status: 403 },
        ),
      ),
    );

    const error = await fetchNoContent("/api/auth/logout", {
      method: "POST",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      code: "forbidden",
      message: "Access is not allowed.",
      status: 403,
    });
  });

  it("uses the HTTP status for non-JSON no-content errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 503 })),
    );

    const error = await fetchNoContent("/api/auth/logout", {
      method: "POST",
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({
      message: "Request failed with status 503",
      status: 503,
    });
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

    await fetchJson("/api/test", OkResponseSchema);
  });
});
