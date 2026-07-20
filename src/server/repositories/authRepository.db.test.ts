import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createDbConnection } from "@/server/db";
import { inviteCodes, sessions, users } from "@/server/db/schema";
import { createInviteRepository } from "@/server/repositories/inviteRepository";
import { createAuthRepository } from "./authRepository";

const describeWithDb =
  process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeWithDb("authRepository database integration", () => {
  let connection: ReturnType<typeof createDbConnection>;
  let concurrentConnection: ReturnType<typeof createDbConnection>;
  const codeHashes: string[] = [];
  const userIds: string[] = [];
  const concurrentDisplayNames: string[] = [];

  beforeAll(() => {
    connection = createDbConnection(
      process.env.DATABASE_URL ??
        "postgres://cherryk:cherryk@localhost:5433/cherryk",
    );
    concurrentConnection = createDbConnection(
      process.env.DATABASE_URL ??
        "postgres://cherryk:cherryk@localhost:5433/cherryk",
    );
  });

  afterAll(async () => {
    if (concurrentDisplayNames.length) {
      await connection.db
        .delete(users)
        .where(inArray(users.displayName, concurrentDisplayNames));
    }
    if (userIds.length) {
      await connection.db.delete(users).where(inArray(users.id, userIds));
    }
    if (codeHashes.length) {
      await connection.db
        .delete(inviteCodes)
        .where(inArray(inviteCodes.codeHash, codeHashes));
    }
    await concurrentConnection.close();
    await connection.close();
  });

  it("claims onboarding and recovery links exactly once", async () => {
    const authRepository = createAuthRepository(connection.db);
    const inviteRepository = createInviteRepository(connection.db);
    const onboardingHash = `test-onboarding-${randomUUID()}`;
    const recoveryHash = `test-recovery-${randomUUID()}`;
    codeHashes.push(onboardingHash, recoveryHash);

    await inviteRepository.createOneTimeInvite({
      codeHash: onboardingHash,
      label: "DB onboarding test",
      userId: null,
    });

    await expect(
      authRepository.createInviteSession({
        inviteCodeHash: onboardingHash,
        displayName: null,
        sessionTokenHash: `test-session-${randomUUID()}`,
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "display_name_required" });

    const onboardingResult = await authRepository.createInviteSession({
      inviteCodeHash: onboardingHash,
      displayName: "Mina",
      sessionTokenHash: `test-session-${randomUUID()}`,
      sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
      now: new Date("2026-07-20T00:00:00.000Z"),
    });

    expect(onboardingResult.status).toBe("authenticated");
    if (onboardingResult.status !== "authenticated") {
      throw new Error("Expected onboarding authentication.");
    }
    userIds.push(onboardingResult.user.id);

    await expect(
      authRepository.createInviteSession({
        inviteCodeHash: onboardingHash,
        displayName: "Another user",
        sessionTokenHash: `test-session-${randomUUID()}`,
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "invalid" });

    await inviteRepository.createOneTimeInvite({
      codeHash: recoveryHash,
      label: "DB recovery test",
      userId: onboardingResult.user.id,
    });

    const recoveryResult = await authRepository.createInviteSession({
      inviteCodeHash: recoveryHash,
      displayName: null,
      sessionTokenHash: `test-session-${randomUUID()}`,
      sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
      now: new Date("2026-07-20T00:00:00.000Z"),
    });

    expect(recoveryResult).toMatchObject({
      status: "authenticated",
      user: { id: onboardingResult.user.id, displayName: "Mina" },
    });

    await expect(
      connection.db
        .select({ usedCount: inviteCodes.usedCount })
        .from(inviteCodes)
        .where(eq(inviteCodes.codeHash, recoveryHash)),
    ).resolves.toEqual([{ usedCount: 1 }]);

    await expect(
      authRepository.createInviteSession({
        inviteCodeHash: recoveryHash,
        displayName: null,
        sessionTokenHash: `test-session-${randomUUID()}`,
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
    ).resolves.toEqual({ status: "invalid" });
  });

  it("serializes simultaneous onboarding and recovery claims", async () => {
    const firstAuthRepository = createAuthRepository(connection.db);
    const secondAuthRepository = createAuthRepository(concurrentConnection.db);
    const inviteRepository = createInviteRepository(connection.db);
    const onboardingHash = `test-concurrent-onboarding-${randomUUID()}`;
    const recoveryHash = `test-concurrent-recovery-${randomUUID()}`;
    const onboardingSessionHashes = [
      `test-concurrent-onboarding-session-${randomUUID()}`,
      `test-concurrent-onboarding-session-${randomUUID()}`,
    ];
    const recoverySessionHashes = [
      `test-concurrent-recovery-session-${randomUUID()}`,
      `test-concurrent-recovery-session-${randomUUID()}`,
    ];
    const displayNames = [
      `Concurrent user A ${randomUUID()}`,
      `Concurrent user B ${randomUUID()}`,
    ];
    concurrentDisplayNames.push(...displayNames);
    codeHashes.push(onboardingHash, recoveryHash);

    await inviteRepository.createOneTimeInvite({
      codeHash: onboardingHash,
      label: "Concurrent onboarding test",
      userId: null,
    });

    const onboardingResults = await Promise.all([
      firstAuthRepository.createInviteSession({
        inviteCodeHash: onboardingHash,
        displayName: displayNames[0],
        sessionTokenHash: onboardingSessionHashes[0],
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
      secondAuthRepository.createInviteSession({
        inviteCodeHash: onboardingHash,
        displayName: displayNames[1],
        sessionTokenHash: onboardingSessionHashes[1],
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
    ]);

    const concurrentUsers = await connection.db
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.displayName, displayNames));
    userIds.push(...concurrentUsers.map((user) => user.id));

    expect(onboardingResults.map((result) => result.status).sort()).toEqual([
      "authenticated",
      "invalid",
    ]);
    expect(concurrentUsers).toHaveLength(1);
    await expect(
      connection.db
        .select({ tokenHash: sessions.tokenHash })
        .from(sessions)
        .where(inArray(sessions.tokenHash, onboardingSessionHashes)),
    ).resolves.toHaveLength(1);

    const authenticatedOnboarding = onboardingResults.find(
      (result) => result.status === "authenticated",
    );
    if (
      !authenticatedOnboarding ||
      authenticatedOnboarding.status !== "authenticated"
    ) {
      throw new Error("Expected one concurrent onboarding authentication.");
    }

    await expect(
      connection.db
        .select({
          usedCount: inviteCodes.usedCount,
          userId: inviteCodes.userId,
        })
        .from(inviteCodes)
        .where(eq(inviteCodes.codeHash, onboardingHash)),
    ).resolves.toEqual([
      { usedCount: 1, userId: authenticatedOnboarding.user.id },
    ]);

    await inviteRepository.createOneTimeInvite({
      codeHash: recoveryHash,
      label: "Concurrent recovery test",
      userId: authenticatedOnboarding.user.id,
    });

    const recoveryResults = await Promise.all([
      firstAuthRepository.createInviteSession({
        inviteCodeHash: recoveryHash,
        displayName: null,
        sessionTokenHash: recoverySessionHashes[0],
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
      secondAuthRepository.createInviteSession({
        inviteCodeHash: recoveryHash,
        displayName: null,
        sessionTokenHash: recoverySessionHashes[1],
        sessionExpiresAt: new Date("2026-08-01T00:00:00.000Z"),
        now: new Date("2026-07-20T00:00:00.000Z"),
      }),
    ]);

    expect(recoveryResults.map((result) => result.status).sort()).toEqual([
      "authenticated",
      "invalid",
    ]);
    expect(
      recoveryResults.find((result) => result.status === "authenticated"),
    ).toMatchObject({
      user: { id: authenticatedOnboarding.user.id },
    });
    await expect(
      connection.db
        .select({ tokenHash: sessions.tokenHash })
        .from(sessions)
        .where(inArray(sessions.tokenHash, recoverySessionHashes)),
    ).resolves.toHaveLength(1);
    await expect(
      connection.db
        .select({ usedCount: inviteCodes.usedCount })
        .from(inviteCodes)
        .where(eq(inviteCodes.codeHash, recoveryHash)),
    ).resolves.toEqual([{ usedCount: 1 }]);
  });
});
