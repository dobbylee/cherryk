import { describe, expect, it, vi } from "vitest";
import { quizChoices, quizQuestions } from "@/server/db/schema";
import { INITIAL_APPROVED_QUIZZES } from "./initialApprovedQuizzes";
import { seedInitialApprovedQuizzes } from "./seedInitialApprovedQuizzes";

function createFakeSeedDb(questionInserted: boolean) {
  const insertedChoices: unknown[] = [];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
    insert: vi.fn((table) => {
      if (table === quizQuestions) {
        return {
          values: vi.fn(() => ({
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(async () =>
                questionInserted
                  ? [{ id: "11111111-1111-4111-8111-111111111111" }]
                  : [],
              ),
            })),
          })),
        };
      }

      if (table === quizChoices) {
        return {
          values: vi.fn((values) => {
            insertedChoices.push(values);
            return Promise.resolve();
          }),
        };
      }

      throw new Error("Unexpected table.");
    }),
  };
  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, insertedChoices };
}

describe("seedInitialApprovedQuizzes", () => {
  it("skips choices when quiz content already exists under another id", async () => {
    const { db, insertedChoices } = createFakeSeedDb(false);

    await expect(seedInitialApprovedQuizzes(db as never)).resolves.toEqual({
      inserted: 0,
      skipped: INITIAL_APPROVED_QUIZZES.length,
    });
    expect(insertedChoices).toEqual([]);
  });

  it("inserts choices only for newly inserted quiz questions", async () => {
    const { db, insertedChoices } = createFakeSeedDb(true);

    await expect(seedInitialApprovedQuizzes(db as never)).resolves.toEqual({
      inserted: INITIAL_APPROVED_QUIZZES.length,
      skipped: 0,
    });
    expect(insertedChoices).toHaveLength(INITIAL_APPROVED_QUIZZES.length);
  });
});
