import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { quizAttempts, quizChoices, quizQuestions } from "@/server/db/schema";
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

function createFakeDraftDb() {
  const insertedQuestions: unknown[] = [];
  const insertedChoices: unknown[] = [];
  const tx = {
    insert: vi.fn((table) => ({
      values: vi.fn((values) => {
        if (table === quizQuestions) {
          insertedQuestions.push(values);
          return {
            returning: vi.fn(async () => [
              { id: "11111111-1111-4111-8111-111111111111" },
            ]),
          };
        }

        if (table === quizChoices) {
          insertedChoices.push(values);
          return Promise.resolve();
        }

        throw new Error("Unexpected table.");
      }),
    })),
  };
  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, insertedQuestions, insertedChoices };
}

function createFakeUpdateDb(
  updatedRows: unknown[] = [],
  attemptedRows: unknown[] = [],
) {
  const updateSet: unknown[] = [];
  const deletedChoices: unknown[] = [];
  const insertedChoices: unknown[] = [];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table) => {
        if (table !== quizAttempts) {
          throw new Error("Unexpected select table.");
        }

        return {
          where: vi.fn(() => ({
            limit: vi.fn(async () => attemptedRows),
          })),
        };
      }),
    })),
    update: vi.fn((table) => {
      if (table !== quizQuestions) {
        throw new Error("Unexpected update table.");
      }

      return {
        set: vi.fn((value) => {
          updateSet.push(value);
          return {
            where: vi.fn(() => ({
              returning: vi.fn(async () => updatedRows),
            })),
          };
        }),
      };
    }),
    delete: vi.fn((table) => {
      if (table !== quizChoices) {
        throw new Error("Unexpected delete table.");
      }

      return {
        where: vi.fn((value) => {
          deletedChoices.push(value);
          return Promise.resolve();
        }),
      };
    }),
    insert: vi.fn((table) => {
      if (table !== quizChoices) {
        throw new Error("Unexpected insert table.");
      }

      return {
        values: vi.fn((values) => {
          insertedChoices.push(values);
          return Promise.resolve();
        }),
      };
    }),
  };
  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, updateSet, deletedChoices, insertedChoices };
}

function createFakeAttemptDb(rows: unknown[] = []) {
  const insertedAttempts: unknown[] = [];
  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table) => {
        if (table !== quizQuestions) {
          throw new Error("Unexpected select table.");
        }

        return {
          innerJoin: vi.fn(() => ({
            where: vi.fn(async () => rows),
          })),
        };
      }),
    })),
    insert: vi.fn((table) => {
      if (table !== quizAttempts) {
        throw new Error("Unexpected insert table.");
      }

      return {
        values: vi.fn((values) => {
          insertedAttempts.push(values);
          return Promise.resolve();
        }),
      };
    }),
  };
  const db = {
    transaction: vi.fn(async (callback) => callback(tx)),
  };

  return { db, insertedAttempts };
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

  it("creates quiz drafts with draft status and sorted choices", async () => {
    const { db, insertedQuestions, insertedChoices } = createFakeDraftDb();
    const repository = createQuizRepository(db as never);

    await expect(
      repository.createQuizDrafts({
        questions: [
          {
            tag: "particle_object",
            difficulty: "beginner",
            questionEn: "Choose the correct particle.",
            sentenceKo: "저는 사과( ) 먹어요.",
            choices: [
              { text: "은", isCorrect: false },
              { text: "를", isCorrect: true },
              { text: "에", isCorrect: false },
              { text: "이", isCorrect: false },
            ],
            answerExplanationEn:
              "Use 를 because 사과 is the direct object of 먹어요.",
          },
        ],
      }),
    ).resolves.toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        tag: "particle_object",
        difficulty: "beginner",
        questionEn: "Choose the correct particle.",
        sentenceKo: "저는 사과( ) 먹어요.",
        choices: [
          { text: "은", isCorrect: false },
          { text: "를", isCorrect: true },
          { text: "에", isCorrect: false },
          { text: "이", isCorrect: false },
        ],
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
      },
    ]);
    expect(insertedQuestions).toEqual([
      {
        tag: "particle_object",
        difficulty: "beginner",
        status: "draft",
        questionEn: "Choose the correct particle.",
        sentenceKo: "저는 사과( ) 먹어요.",
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
        source: "ai_draft",
      },
    ]);
    expect(insertedChoices).toEqual([
      [
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "은",
          isCorrect: false,
          sortOrder: 0,
        },
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "를",
          isCorrect: true,
          sortOrder: 1,
        },
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "에",
          isCorrect: false,
          sortOrder: 2,
        },
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "이",
          isCorrect: false,
          sortOrder: 3,
        },
      ],
    ]);
  });

  it("updates quiz review fields and replaces choices", async () => {
    const now = new Date("2026-07-09T00:00:00.000Z");
    const { db, updateSet, deletedChoices, insertedChoices } =
      createFakeUpdateDb([
        {
          id: "11111111-1111-4111-8111-111111111111",
          status: "approved",
        },
      ]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.updateQuiz({
        id: "11111111-1111-4111-8111-111111111111",
        now,
        update: {
          status: "approved",
          reviewNote: "Ready.",
          choices: [
            { text: "은", isCorrect: false, sortOrder: 0 },
            { text: "를", isCorrect: true, sortOrder: 1 },
            { text: "에", isCorrect: false, sortOrder: 2 },
            { text: "이", isCorrect: false, sortOrder: 3 },
          ],
        },
      }),
    ).resolves.toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      status: "approved",
    });
    expect(updateSet).toEqual([
      {
        status: "approved",
        reviewNote: "Ready.",
        updatedAt: now,
      },
    ]);
    expect(deletedChoices).toHaveLength(1);
    expect(insertedChoices).toEqual([
      [
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "은",
          isCorrect: false,
          sortOrder: 0,
        },
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "를",
          isCorrect: true,
          sortOrder: 1,
        },
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "에",
          isCorrect: false,
          sortOrder: 2,
        },
        {
          quizQuestionId: "11111111-1111-4111-8111-111111111111",
          choiceText: "이",
          isCorrect: false,
          sortOrder: 3,
        },
      ],
    ]);
  });

  it("returns null when a quiz update does not match a quiz", async () => {
    const { db, insertedChoices } = createFakeUpdateDb([]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.updateQuiz({
        id: "11111111-1111-4111-8111-111111111111",
        now: new Date("2026-07-09T00:00:00.000Z"),
        update: {
          status: "approved",
          choices: [
            { text: "은", isCorrect: false, sortOrder: 0 },
            { text: "를", isCorrect: true, sortOrder: 1 },
            { text: "에", isCorrect: false, sortOrder: 2 },
            { text: "이", isCorrect: false, sortOrder: 3 },
          ],
        },
      }),
    ).resolves.toBeNull();
    expect(insertedChoices).toEqual([]);
  });

  it("rejects choice replacement when attempts already reference choices", async () => {
    const { db, updateSet, deletedChoices, insertedChoices } =
      createFakeUpdateDb(
        [
          {
            id: "11111111-1111-4111-8111-111111111111",
            status: "approved",
          },
        ],
        [{ id: "22222222-2222-4222-8222-222222222222" }],
      );
    const repository = createQuizRepository(db as never);

    await expect(
      repository.updateQuiz({
        id: "11111111-1111-4111-8111-111111111111",
        now: new Date("2026-07-09T00:00:00.000Z"),
        update: {
          choices: [
            { text: "은", isCorrect: false, sortOrder: 0 },
            { text: "를", isCorrect: true, sortOrder: 1 },
            { text: "에", isCorrect: false, sortOrder: 2 },
            { text: "이", isCorrect: false, sortOrder: 3 },
          ],
        },
      }),
    ).resolves.toEqual({ code: "quiz_choices_locked" });
    expect(updateSet).toEqual([]);
    expect(deletedChoices).toEqual([]);
    expect(insertedChoices).toEqual([]);
  });

  it("records attempts for approved quizzes and returns the answer", async () => {
    const { db, insertedAttempts } = createFakeAttemptDb([
      {
        quizId: "11111111-1111-4111-8111-111111111111",
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
        choiceId: "22222222-2222-4222-8222-222222222222",
        isCorrect: false,
      },
      {
        quizId: "11111111-1111-4111-8111-111111111111",
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
        choiceId: "33333333-3333-4333-8333-333333333333",
        isCorrect: true,
      },
    ]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.recordQuizAttempt({
        userId: "44444444-4444-4444-8444-444444444444",
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "33333333-3333-4333-8333-333333333333",
      }),
    ).resolves.toEqual({
      isCorrect: true,
      correctChoiceId: "33333333-3333-4333-8333-333333333333",
      explanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
    });
    expect(eq).toHaveBeenCalledWith(quizQuestions.status, "approved");
    expect(insertedAttempts).toEqual([
      {
        userId: "44444444-4444-4444-8444-444444444444",
        quizQuestionId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "33333333-3333-4333-8333-333333333333",
        isCorrect: true,
      },
    ]);
  });

  it("returns null when an approved quiz is not available", async () => {
    const { db, insertedAttempts } = createFakeAttemptDb([]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.recordQuizAttempt({
        userId: "44444444-4444-4444-8444-444444444444",
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "33333333-3333-4333-8333-333333333333",
      }),
    ).resolves.toBeNull();
    expect(insertedAttempts).toEqual([]);
  });

  it("rejects selected choices that do not belong to the quiz", async () => {
    const { db, insertedAttempts } = createFakeAttemptDb([
      {
        quizId: "11111111-1111-4111-8111-111111111111",
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
        choiceId: "22222222-2222-4222-8222-222222222222",
        isCorrect: false,
      },
      {
        quizId: "11111111-1111-4111-8111-111111111111",
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
        choiceId: "33333333-3333-4333-8333-333333333333",
        isCorrect: true,
      },
    ]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.recordQuizAttempt({
        userId: "44444444-4444-4444-8444-444444444444",
        quizId: "11111111-1111-4111-8111-111111111111",
        selectedChoiceId: "55555555-5555-4555-8555-555555555555",
      }),
    ).resolves.toEqual({ code: "invalid_choice" });
    expect(insertedAttempts).toEqual([]);
  });
});
