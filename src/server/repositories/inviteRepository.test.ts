import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInviteRepository } from "./inviteRepository";

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  asc: vi.fn((column: unknown) => ({ type: "asc", column })),
  desc: vi.fn((column: unknown) => ({ type: "desc", column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
  lte: vi.fn((left: unknown, right: unknown) => ({ type: "lte", left, right })),
}));

function createFakeDb(rows: unknown[]) {
  const query = {
    from: vi.fn(() => query),
    leftJoin: vi.fn((table: unknown, condition: unknown) => {
      void table;
      void condition;
      return query;
    }),
    orderBy: vi.fn(async () => rows),
  };

  return {
    db: {
      select: vi.fn(() => query),
    },
    query,
  };
}

describe("inviteRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists each user once with their onboarding invite label", async () => {
    const mina = {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Mina",
    };
    const { db, query } = createFakeDb([
      { ...mina, inviteLabel: "Mina invite" },
      {
        id: "22222222-2222-4222-8222-222222222222",
        displayName: "Joon",
        inviteLabel: null,
      },
    ]);

    const repository = createInviteRepository(
      db as unknown as Parameters<typeof createInviteRepository>[0],
    );

    await expect(repository.listUsers()).resolves.toEqual([
      { ...mina, inviteLabel: "Mina invite" },
      {
        id: "22222222-2222-4222-8222-222222222222",
        displayName: "Joon",
        inviteLabel: null,
      },
    ]);
    expect(query.leftJoin).toHaveBeenCalledOnce();
    expect(query.leftJoin.mock.calls[0]?.[1]).toMatchObject({
      type: "and",
      conditions: [{ type: "eq" }, { type: "lte" }],
    });
  });
});
