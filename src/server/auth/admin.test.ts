import { describe, expect, it, vi } from "vitest";
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
});
