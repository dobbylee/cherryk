import { and, asc, desc, eq, lte } from "drizzle-orm";
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
  findUserById(userId: string): Promise<{ id: string } | null>;
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
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      return user ?? null;
    },

    async listUsers() {
      const rows = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          inviteLabel: inviteCodes.label,
        })
        .from(users)
        .leftJoin(
          inviteCodes,
          and(
            eq(inviteCodes.userId, users.id),
            lte(inviteCodes.createdAt, users.createdAt),
          ),
        )
        .orderBy(
          desc(users.createdAt),
          asc(inviteCodes.createdAt),
          asc(inviteCodes.id),
        );

      const usersById = new Map<string, AdminInviteUser>();
      for (const row of rows) {
        if (!usersById.has(row.id)) {
          usersById.set(row.id, row);
        }
      }

      return [...usersById.values()];
    },
  };
}
