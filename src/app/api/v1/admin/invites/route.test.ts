import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SECRET_HEADER } from "@/server/auth/admin";
import { GET, POST } from "./route";

const testUser = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Mina",
};

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(() => ({})),
  createInviteRepository: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  createDb: mocks.createDb,
}));

vi.mock("@/server/repositories/inviteRepository", () => ({
  createInviteRepository: mocks.createInviteRepository,
}));

describe("/api/v1/admin/invites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ADMIN_SECRET", "test-admin-secret");
    vi.stubEnv("AUTH_SECRET", "test-auth-secret");
    mocks.createInviteRepository.mockReturnValue({
      async createOneTimeInvite(input: {
        codeHash: string;
        label: string;
        userId: string | null;
      }) {
        expect(input.label).toBe("Mina invite");
        expect(input.userId).toBeNull();
        expect(input.codeHash).not.toContain("Mina invite");
      },
      async findUserById(userId: string) {
        return userId === testUser.id ? testUser : null;
      },
      async listUsers() {
        return [testUser];
      },
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lists users for recovery without caching the response", async () => {
    const response = await GET(
      new Request("https://cherryk.example/api/v1/admin/invites", {
        headers: { [ADMIN_SECRET_HEADER]: "test-admin-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ users: [testUser] });
  });

  it("creates a one-time invite link for the request origin", async () => {
    const response = await POST(
      new Request("https://cherryk.example/api/v1/admin/invites", {
        method: "POST",
        headers: {
          [ADMIN_SECRET_HEADER]: "test-admin-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label: "Mina invite" }),
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(payload.kind).toBe("invite");
    expect(payload.link).toMatch(
      /^https:\/\/cherryk\.example\/join\?invite=[A-Za-z0-9_-]{43}$/,
    );
  });

  it("rejects requests without the admin secret before database access", async () => {
    const response = await POST(
      new Request("https://cherryk.example/api/v1/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "Mina invite" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.createInviteRepository).not.toHaveBeenCalled();
  });

  it("rejects invalid invite requests before database access", async () => {
    const response = await POST(
      new Request("https://cherryk.example/api/v1/admin/invites", {
        method: "POST",
        headers: {
          [ADMIN_SECRET_HEADER]: "test-admin-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ label: "" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.createInviteRepository).not.toHaveBeenCalled();
  });
});
