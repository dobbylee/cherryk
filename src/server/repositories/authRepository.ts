import { and, eq, gt, sql } from "drizzle-orm";
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

export type CreateInviteSessionResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "display_name_required" }
  | { status: "invalid" };

export type SeedInviteCodeInput = {
  codeHash: string;
  label: string | null;
  maxUses: number;
  expiresAt: Date | null;
};

export type AuthRepository = {
  createInviteSession(
    input: CreateInviteSessionInput,
  ): Promise<CreateInviteSessionResult>;
  findUserBySessionTokenHash(
    tokenHash: string,
    now: Date,
  ): Promise<AuthUser | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  upsertInviteCode(input: SeedInviteCodeInput): Promise<void>;
};

export function createAuthRepository(db: Db): AuthRepository {
  return {
    createInviteSession: (input) => createInviteSession(db, input),
    findUserBySessionTokenHash: (tokenHash, now) =>
      findUserBySessionTokenHash(db, tokenHash, now),
    deleteSessionByTokenHash: (tokenHash) =>
      deleteSessionByTokenHash(db, tokenHash),
    upsertInviteCode: (input) => upsertInviteCode(db, input),
  };
}

async function createInviteSession(
  db: Db,
  input: CreateInviteSessionInput,
): Promise<CreateInviteSessionResult> {
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select({
        id: inviteCodes.id,
        userId: inviteCodes.userId,
        maxUses: inviteCodes.maxUses,
        usedCount: inviteCodes.usedCount,
        expiresAt: inviteCodes.expiresAt,
      })
      .from(inviteCodes)
      .where(eq(inviteCodes.codeHash, input.inviteCodeHash))
      .limit(1)
      .for("update");

    if (
      !invite ||
      invite.usedCount >= invite.maxUses ||
      (invite.expiresAt !== null && invite.expiresAt <= input.now)
    ) {
      return { status: "invalid" };
    }

    let user: AuthUser | undefined;

    if (invite.userId) {
      const [existingUser] = await tx
        .select({
          id: users.id,
          displayName: users.displayName,
          level: users.level,
        })
        .from(users)
        .where(eq(users.id, invite.userId))
        .limit(1);
      user = existingUser ? AuthUserSchema.parse(existingUser) : undefined;
    } else {
      if (!input.displayName) {
        return { status: "display_name_required" };
      }

      const [createdUser] = await tx
        .insert(users)
        .values({
          displayName: input.displayName,
        })
        .returning({
          id: users.id,
          displayName: users.displayName,
          level: users.level,
        });
      user = createdUser ? AuthUserSchema.parse(createdUser) : undefined;
    }

    if (!user) {
      throw new Error("Failed to create user.");
    }

    await tx
      .update(inviteCodes)
      .set({
        usedCount: sql`${inviteCodes.usedCount} + 1`,
        userId: user.id,
      })
      .where(eq(inviteCodes.id, invite.id));

    await tx.insert(sessions).values({
      userId: user.id,
      tokenHash: input.sessionTokenHash,
      expiresAt: input.sessionExpiresAt,
    });

    return {
      status: "authenticated",
      user,
    };
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

async function upsertInviteCode(db: Db, input: SeedInviteCodeInput) {
  await db
    .insert(inviteCodes)
    .values({
      codeHash: input.codeHash,
      label: input.label,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt,
      usedCount: 0,
    })
    .onConflictDoUpdate({
      target: inviteCodes.codeHash,
      set: {
        label: input.label,
        maxUses: input.maxUses,
        expiresAt: input.expiresAt,
      },
    });
}
