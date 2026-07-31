import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAdminAccount } from "./adminAccess";

const request = new Request("http://localhost/admin/quizzes");

describe("Spring admin access helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts access allowed by Spring", async () => {
    const resolveSpringAccess = vi.fn(async () => "allowed" as const);

    await expect(
      requireAdminAccount(
        request,
        "https://api-preview.cherryk.kr",
        resolveSpringAccess,
      ),
    ).resolves.toBeUndefined();
    expect(resolveSpringAccess).toHaveBeenCalledWith(
      "https://api-preview.cherryk.kr",
      request.headers,
    );
  });

  it("forwards only the Spring session cookie", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response(null, { status: 204 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const springRequest = new Request(
      "https://preview.cherryk.kr/admin/quizzes",
      {
        headers: {
          cookie:
            "vercel_protection=private; CHERRYK_SESSION=spring-session; other=value",
        },
      },
    );

    await expect(
      requireAdminAccount(springRequest, "https://api-preview.cherryk.kr"),
    ).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url.toString()).toBe(
      "https://api-preview.cherryk.kr/api/v1/admin/access",
    );
    expect(init).toMatchObject({
      cache: "no-store",
      headers: { cookie: "CHERRYK_SESSION=spring-session" },
      redirect: "manual",
    });
  });

  it("rejects missing or invalid Spring origins before forwarding cookies", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(requireAdminAccount(request, undefined)).rejects.toThrow(
      "SPRING_BACKEND_ORIGIN is required",
    );
    await expect(
      requireAdminAccount(
        request,
        "https://api-preview.cherryk.kr/unexpected-path",
      ),
    ).rejects.toThrow(
      "SPRING_BACKEND_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.",
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthorized", "unauthorized", "Authentication required."],
    ["forbidden", "forbidden", "Admin access is not allowed."],
  ] as const)(
    "maps Spring %s access to the %s layout error",
    async (springAccess, code, message) => {
      await expect(
        requireAdminAccount(
          request,
          "https://api-preview.cherryk.kr",
          async () => springAccess,
        ),
      ).rejects.toMatchObject({ code, message });
    },
  );
});
