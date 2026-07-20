import { desc, eq } from "drizzle-orm";
import type { AdminInviteUser } from "@/lib/contracts/invite";
import type { Db } from "@/server/db";
import { inviteCodes, users } from "@/server/db/schema";

export type CreateOneTimeInviteInput = {
  codeHash: string;
  label: string;
  userId: string | null;
};

export type InviteRepository = {
  createOneTimeInvite(input: CreateOneTimeInviteInput): Promise<void>;
  findUserById(userId: string): Promise<AdminInviteUser | null>;
  listUsers(): Promise<AdminInviteUser[]>;
};

export function createInviteRepository(db: Db): InviteRepository {
  return {
    async createOneTimeInvite(input) {
      await db.insert(inviteCodes).values({
        codeHash: input.codeHash,
        label: input.label,
        userId: input.userId,
        maxUses: 1,
        usedCount: 0,
      });
    },

    async findUserById(userId) {
      const [user] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user ?? null;
    },

    listUsers: () =>
      db
        .select({
          id: users.id,
          displayName: users.displayName,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
  };
}
