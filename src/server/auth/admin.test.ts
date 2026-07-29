import { afterEach, describe, expect, it, vi } from "vitest";
import { requireAdminAccount } from "./admin";

vi.mock("@/server/auth/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const request = new Request("http://localhost/api/v1/admin/quizzes");

describe("admin auth helper", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a verified Google account on the configured email allowlist", async () => {
    const resolveSession = vi.fn(async () => ({
      user: {
        email: " Owner@Example.com ",
        emailVerified: true,
      },
    }));

    await expect(
      requireAdminAccount(
        request,
        "admin@example.com, owner@example.com",
        resolveSession,
      ),
    ).resolves.toBeUndefined();
    expect(resolveSession).toHaveBeenCalledWith(request.headers);
  });

  it("rejects requests without an authenticated account", async () => {
    await expect(
      requireAdminAccount(request, "owner@example.com", async () => null),
    ).rejects.toMatchObject({
      code: "unauthorized",
      message: "Authentication required.",
    });
  });

  it("rejects accounts outside the allowlist or without verified email", async () => {
    await expect(
      requireAdminAccount(request, "owner@example.com", async () => ({
        user: {
          email: "someone@example.com",
          emailVerified: true,
        },
      })),
    ).rejects.toMatchObject({
      code: "forbidden",
      message: "Admin access is not allowed.",
    });

    await expect(
      requireAdminAccount(request, "owner@example.com", async () => ({
        user: {
          email: "owner@example.com",
          emailVerified: false,
        },
      })),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("does not allow admin routes when ADMIN_EMAILS is empty", async () => {
    await expect(
      requireAdminAccount(request, "  , ", async () => ({
        user: {
          email: "owner@example.com",
          emailVerified: true,
        },
      })),
    ).rejects.toMatchObject({
      code: "admin_not_configured",
      message: "Admin access is not configured.",
    });
  });

  it("delegates admin authorization to Spring when its backend origin is configured", async () => {
    const resolveSession = vi.fn();
    const resolveSpringAccess = vi.fn(async () => "allowed" as const);

    await expect(
      requireAdminAccount(
        request,
        undefined,
        resolveSession,
        "https://api-preview.cherryk.kr",
        resolveSpringAccess,
      ),
    ).resolves.toBeUndefined();

    expect(resolveSession).not.toHaveBeenCalled();
    expect(resolveSpringAccess).toHaveBeenCalledWith(
      "https://api-preview.cherryk.kr",
      request.headers,
    );
  });

  it("keeps Better Auth admin authorization when the Spring origin is blank", async () => {
    const resolveSession = vi.fn(async () => ({
      user: {
        email: "owner@example.com",
        emailVerified: true,
      },
    }));
    const resolveSpringAccess = vi.fn();

    await expect(
      requireAdminAccount(
        request,
        "owner@example.com",
        resolveSession,
        "   ",
        resolveSpringAccess,
      ),
    ).resolves.toBeUndefined();

    expect(resolveSession).toHaveBeenCalledWith(request.headers);
    expect(resolveSpringAccess).not.toHaveBeenCalled();
  });

  it("forwards only the Spring session cookie to the configured backend", async () => {
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
      requireAdminAccount(
        springRequest,
        undefined,
        vi.fn(),
        "https://api-preview.cherryk.kr",
      ),
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

  it("rejects an invalid Spring origin before forwarding the session cookie", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      requireAdminAccount(
        new Request("https://preview.cherryk.kr/admin/quizzes", {
          headers: { cookie: "CHERRYK_SESSION=spring-session" },
        }),
        undefined,
        vi.fn(),
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
    "maps Spring %s access to the existing %s layout error",
    async (springAccess, code, message) => {
      await expect(
        requireAdminAccount(
          request,
          undefined,
          vi.fn(),
          "https://api-preview.cherryk.kr",
          async () => springAccess,
        ),
      ).rejects.toMatchObject({ code, message });
    },
  );
});
