import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECRET_HEADER } from "@/lib/contracts/admin";
import { createAdminInvite, fetchAdminInviteUsers } from "./adminInvites";

describe("admin invite API helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads recovery users with the admin secret header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/api/v1/admin/invites");
        expect(new Headers(init?.headers).get(ADMIN_SECRET_HEADER)).toBe(
          "test-admin-secret",
        );
        return Response.json({ users: [] });
      }),
    );

    await expect(fetchAdminInviteUsers("test-admin-secret")).resolves.toEqual({
      users: [],
    });
  });

  it("creates an invite link with the admin secret header", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/api/v1/admin/invites");
        expect(init?.method).toBe("POST");
        expect(new Headers(init?.headers).get(ADMIN_SECRET_HEADER)).toBe(
          "test-admin-secret",
        );
        expect(init?.body).toBe(JSON.stringify({ label: "Mina invite" }));
        return Response.json({
          kind: "invite",
          link: "https://cherryk.example/join?invite=raw-code",
        });
      }),
    );

    await expect(
      createAdminInvite("test-admin-secret", { label: "Mina invite" }),
    ).resolves.toEqual({
      kind: "invite",
      link: "https://cherryk.example/join?invite=raw-code",
    });
  });
});
