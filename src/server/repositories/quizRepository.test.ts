import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { quizQuestions } from "@/server/db/schema";
import { createQuizRepository } from "./quizRepository";

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  asc: vi.fn((column: unknown) => ({ type: "asc", column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
  inArray: vi.fn((left: unknown, right: unknown) => ({
    type: "inArray",
    left,
    right,
  })),
}));

function createFakeDb(rows: unknown[] = []) {
  const query = {
    from: vi.fn(() => query),
    innerJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(async () => rows),
  };
  const db = {
    select: vi.fn(() => query),
  };

  return { db, query };
}

describe("quizRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("filters public quiz lookups to approved questions", async () => {
    const { db } = createFakeDb();
    const repository = createQuizRepository(db as never);

    await repository.findApprovedQuizzesByTags(["particle_object"]);

    expect(eq).toHaveBeenCalledWith(quizQuestions.status, "approved");
  });

  it("does not query when no tags are requested", async () => {
    const { db } = createFakeDb();
    const repository = createQuizRepository(db as never);

    await expect(repository.findApprovedQuizzesByTags([])).resolves.toEqual([]);
    expect(db.select).not.toHaveBeenCalled();
  });
});
