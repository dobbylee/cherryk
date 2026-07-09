import { describe, expect, it } from "vitest";
import {
  ADMIN_SECRET_HEADER,
  AdminAuthError,
  requireAdminSecret,
} from "./admin";

describe("admin auth helper", () => {
  it("accepts the configured admin secret header", () => {
    const request = new Request("http://localhost/api/v1/admin/quizzes", {
      headers: {
        [ADMIN_SECRET_HEADER]: "test-admin-secret",
      },
    });

    expect(() => requireAdminSecret(request, "test-admin-secret")).not.toThrow();
  });

  it("rejects missing or invalid admin secrets", () => {
    const request = new Request("http://localhost/api/v1/admin/quizzes");

    expect(() => requireAdminSecret(request, "test-admin-secret")).toThrow(
      AdminAuthError,
    );

    const wrongSecretRequest = new Request(
      "http://localhost/api/v1/admin/quizzes",
      {
        headers: {
          [ADMIN_SECRET_HEADER]: "wrong-secret",
        },
      },
    );

    expect(() =>
      requireAdminSecret(wrongSecretRequest, "test-admin-secret"),
    ).toThrow(AdminAuthError);
  });

  it("does not silently allow admin routes when ADMIN_SECRET is absent", () => {
    const request = new Request("http://localhost/api/v1/admin/quizzes", {
      headers: {
        [ADMIN_SECRET_HEADER]: "test-admin-secret",
      },
    });

    expect(() => requireAdminSecret(request, "")).toThrow(AdminAuthError);
  });
});
