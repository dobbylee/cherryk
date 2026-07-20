import { describe, expect, it } from "vitest";
import type { AuthUser } from "@/lib/contracts/auth";
import {
  SESSION_COOKIE_NAME,
  hashInviteCode,
  hashSessionToken,
} from "@/server/auth/session";
import type {
  AuthRepository,
  CreateInviteSessionInput,
  SeedInviteCodeInput,
} from "@/server/repositories/authRepository";
import { AuthServiceError, createAuthService } from "./authService";

const testNow = new Date("2026-07-08T00:00:00.000Z");
const testUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Friend",
  level: "beginner",
};

function createFakeRepository(
  overrides: Partial<AuthRepository> = {},
): AuthRepository & {
  inviteSessionInput: CreateInviteSessionInput | null;
  deletedTokenHash: string | null;
  seedInviteCodeInput: SeedInviteCodeInput | null;
} {
  const repository: AuthRepository & {
    inviteSessionInput: CreateInviteSessionInput | null;
    deletedTokenHash: string | null;
    seedInviteCodeInput: SeedInviteCodeInput | null;
  } = {
    inviteSessionInput: null,
    deletedTokenHash: null,
    seedInviteCodeInput: null,
    async createInviteSession(input: CreateInviteSessionInput) {
      repository.inviteSessionInput = input;
      return { status: "authenticated", user: testUser };
    },
    async findUserBySessionTokenHash() {
      return testUser;
    },
    async deleteSessionByTokenHash(tokenHash: string) {
      repository.deletedTokenHash = tokenHash;
    },
    async upsertInviteCode(input: SeedInviteCodeInput) {
      repository.seedInviteCodeInput = input;
    },
    ...overrides,
  };

  return repository;
}

describe("authService", () => {
  it("creates a user session from a valid invite code", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository, {
      authSecret: "test-secret",
      now: () => testNow,
      createToken: () => "raw-session-token",
    });

    const result = await service.loginWithInvite({
      inviteCode: "local-invite-code",
      displayName: "Friend",
    });

    expect(result.user).toEqual(testUser);
    expect(result.sessionToken).toBe("raw-session-token");
    expect(repository.inviteSessionInput).toMatchObject({
      inviteCodeHash: hashInviteCode("local-invite-code", "test-secret"),
      displayName: "Friend",
      sessionTokenHash: hashSessionToken("raw-session-token", "test-secret"),
      now: testNow,
    });
  });

  it("rejects invalid invite codes before creating a session", async () => {
    const service = createAuthService(
      createFakeRepository({
        async createInviteSession() {
          return { status: "invalid" };
        },
      }),
      {
        authSecret: "test-secret",
        now: () => testNow,
        createToken: () => "raw-session-token",
      },
    );

    await expect(
      service.loginWithInvite({
        inviteCode: "bad-code",
      }),
    ).rejects.toBeInstanceOf(AuthServiceError);
  });

  it("requires a display name when an unclaimed invite is used", async () => {
    const service = createAuthService(
      createFakeRepository({
        async createInviteSession() {
          return { status: "display_name_required" };
        },
      }),
      {
        authSecret: "test-secret",
        now: () => testNow,
        createToken: () => "raw-session-token",
      },
    );

    await expect(
      service.loginWithInvite({ inviteCode: "new-user-code" }),
    ).rejects.toMatchObject({
      code: "display_name_required",
    });
  });

  it("allows recovery invites to authenticate without another display name", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository, {
      authSecret: "test-secret",
      now: () => testNow,
      createToken: () => "raw-session-token",
    });

    await expect(
      service.loginWithInvite({ inviteCode: "recovery-code" }),
    ).resolves.toMatchObject({ user: testUser });
    expect(repository.inviteSessionInput?.displayName).toBeNull();
  });

  it("reads the current user from a session cookie", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository, {
      authSecret: "test-secret",
      now: () => testNow,
    });
    const request = new Request("http://localhost/api/v1/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=raw-session-token`,
      },
    });

    await expect(service.getCurrentUser(request)).resolves.toEqual(testUser);
  });

  it("requires a current user for protected routes", async () => {
    const service = createAuthService(createFakeRepository(), {
      authSecret: "test-secret",
      now: () => testNow,
    });
    const request = new Request("http://localhost/api/v1/corrections", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=raw-session-token`,
      },
    });

    await expect(service.requireCurrentUser(request)).resolves.toEqual(
      testUser,
    );
  });

  it("rejects protected requests without a session", async () => {
    const service = createAuthService(createFakeRepository(), {
      authSecret: "test-secret",
      now: () => testNow,
    });
    const request = new Request("http://localhost/api/v1/corrections");

    await expect(service.requireCurrentUser(request)).rejects.toMatchObject({
      code: "unauthorized",
    });
  });

  it("deletes the hashed session token on logout", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository, {
      authSecret: "test-secret",
      now: () => testNow,
    });
    const request = new Request("http://localhost/api/v1/auth/logout", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=raw-session-token`,
      },
    });

    await service.logout(request);

    expect(repository.deletedTokenHash).toBe(
      hashSessionToken("raw-session-token", "test-secret"),
    );
  });

  it("seeds an invite code hash without storing the raw code", async () => {
    const repository = createFakeRepository();
    const service = createAuthService(repository, {
      authSecret: "test-secret",
    });

    await service.seedInviteCode({
      inviteCode: " local-invite-code ",
      label: "Local development",
    });

    expect(repository.seedInviteCodeInput).toEqual({
      codeHash: hashInviteCode("local-invite-code", "test-secret"),
      label: "Local development",
      maxUses: 1,
      expiresAt: null,
    });
  });

  it("rejects invalid invite seed input", async () => {
    const service = createAuthService(createFakeRepository(), {
      authSecret: "test-secret",
    });

    await expect(
      service.seedInviteCode({
        inviteCode: " ",
      }),
    ).rejects.toMatchObject({
      code: "invalid_invite_seed",
    });
  });
});
