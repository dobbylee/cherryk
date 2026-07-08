import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { AuthUserSchema, type AuthUser } from "@/lib/contracts/auth";
import type { Db } from "@/server/db";
import { inviteCodes, sessions, users } from "@/server/db/schema";

export type CreateInviteSessionInput = {
  inviteCodeHash: string;
  displayName: string | null;
  sessionTokenHash: string;
  sessionExpiresAt: Date;
  now: Date;
};

export type AuthRepository = {
  createInviteSession(
    input: CreateInviteSessionInput,
  ): Promise<AuthUser | null>;
  findUserBySessionTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<AuthUser | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
};

export function createAuthRepository(db: Db): AuthRepository {
  return {
    createInviteSession: (input) => createInviteSession(db, input),
    findUserBySessionTokenHash: (tokenHash, now) =>
      findUserBySessionTokenHash(db, tokenHash, now),
    deleteSessionByTokenHash: (tokenHash) =>
      deleteSessionByTokenHash(db, tokenHash),
  };
}

async function createInviteSession(
  db: Db,
  input: CreateInviteSessionInput,
): Promise<AuthUser | null> {
  return db.transaction(async (tx) => {
    const [claimedInvite] = await tx
      .update(inviteCodes)
      .set({
        usedCount: sql`${inviteCodes.usedCount} + 1`,
      })
      .where(
        and(
          eq(inviteCodes.codeHash, input.inviteCodeHash),
          sql`${inviteCodes.usedCount} < ${inviteCodes.maxUses}`,
          or(
            isNull(inviteCodes.expiresAt),
            gt(inviteCodes.expiresAt, input.now),
          ),
        ),
      )
      .returning({ id: inviteCodes.id });

    if (!claimedInvite) {
      return null;
    }

    const [user] = await tx
      .insert(users)
      .values({
        displayName: input.displayName,
      })
      .returning({
        id: users.id,
        displayName: users.displayName,
        level: users.level,
      });

    if (!user) {
      throw new Error("Failed to create user.");
    }

    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash: input.sessionTokenHash,
      expiresAt: input.sessionExpiresAt,
    });

    return AuthUserSchema.parse(user);
  });
}

async function findUserBySessionTokenHash(
  db: Db,
  tokenHash: string,
  now: Date,
): Promise<AuthUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      level: users.level,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  return user ? AuthUserSchema.parse(user) : null;
}

async function deleteSessionByTokenHash(db: Db, tokenHash: string) {
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}
