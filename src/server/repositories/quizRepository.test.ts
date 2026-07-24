import { desc, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { quizAttempts, quizChoices, quizQuestions } from "@/server/db/schema";
import { createQuizRepository } from "./quizRepository";

vi.mock("drizzle-orm", () => ({
  and: vi.fn((...conditions: unknown[]) => ({ type: "and", conditions })),
  asc: vi.fn((column: unknown) => ({ type: "asc", column })),
  desc: vi.fn((column: unknown) => ({ type: "desc", column })),
  eq: vi.fn((left: unknown, right: unknown) => ({ type: "eq", left, right })),
  inArray: vi.fn((left: unknown, right: unknown) => ({
    type: "inArray",
    left,
    right,
  })),
  sql: vi.fn(() => ({
    type: "sql",
    mapWith: vi.fn(() => ({ type: "mappedSql" })),
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

function createFakeTopTagsDb(rows: unknown[] = []) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(async () => rows),
  };
  const db = {
    select: vi.fn(() => query),
  };

  return { db };
}

function createFakeAttemptSummariesDb(rows: unknown[] = []) {
  const query = {
    from: vi.fn(() => query),
    where: vi.fn(() => query),
    groupBy: vi.fn(async () => rows),
  };
  const db = {
    select: vi.fn(() => query),
  };

  return { db, query };
}

function createFakeDraftDb(
  questionRows: unknown[][] = [
    [{ id: "11111111-1111-4111-8111-111111111111" }],
  ],
) {
  const insertedQuestions: unknown[] = [];
  const insertedChoices: unknown[] = [];
  let questionInsertIndex = 0;
  const tx = {
    insert: vi.fn((table) => ({
      values: vi.fn((values) => {
        if (table === quizQuestions) {
          insertedQuestions.push(values);
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn(
                async () => questionRows[questionInsertIndex++] ?? [],
              ),
            })),
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

function createFakeDeleteDraftDb(deletedRows: unknown[] = []) {
  const returning = vi.fn(async () => deletedRows);
  const where = vi.fn(() => ({ returning }));
  const db = {
    delete: vi.fn((table) => {
      if (table !== quizQuestions) {
        throw new Error("Unexpected delete table.");
      }

      return { where };
    }),
  };

  return { db };
}

function createFakeUpdateDb(
  updatedRows: unknown[] = [],
  attemptedRows: unknown[] = [],
  currentQuizRows: unknown[] = updatedRows.length > 0
    ? [
        {
          tag: "particle_object",
          difficulty: "beginner",
          sentenceKo: "저는 사과( ) 먹어요.",
          choiceText: "은",
          isCorrect: false,
        },
        {
          tag: "particle_object",
          difficulty: "beginner",
          sentenceKo: "저는 사과( ) 먹어요.",
          choiceText: "를",
          isCorrect: true,
        },
        {
          tag: "particle_object",
          difficulty: "beginner",
          sentenceKo: "저는 사과( ) 먹어요.",
          choiceText: "에",
          isCorrect: false,
        },
        {
          tag: "particle_object",
          difficulty: "beginner",
          sentenceKo: "저는 사과( ) 먹어요.",
          choiceText: "이",
          isCorrect: false,
        },
      ]
    : [],
) {
  const updateSet: unknown[] = [];
  const deletedChoices: unknown[] = [];
  const insertedChoices: unknown[] = [];
  const lockForUpdate = vi.fn(async () =>
    updatedRows.length > 0
      ? [{ id: "11111111-1111-4111-8111-111111111111" }]
      : [],
  );
  const tx = {
    select: vi.fn((selection) => ({
      from: vi.fn((table) => {
        if (table === quizAttempts) {
          return {
            where: vi.fn(() => ({
              limit: vi.fn(async () => attemptedRows),
            })),
          };
        }

        if (table === quizQuestions) {
          if (Object.keys(selection).length === 1 && "id" in selection) {
            return {
              where: vi.fn(() => ({
                for: lockForUpdate,
              })),
            };
          }

          return {
            innerJoin: vi.fn(() => ({
              where: vi.fn(async () => currentQuizRows),
            })),
          };
        }

        throw new Error("Unexpected select table.");
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

  return {
    db,
    updateSet,
    deletedChoices,
    insertedChoices,
    lockForUpdate,
  };
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

  it("returns all approved quizzes when no tags are requested", async () => {
    const { db } = createFakeDb();
    const repository = createQuizRepository(db as never);

    await expect(repository.findApprovedQuizzesByTags([])).resolves.toEqual([]);
    expect(db.select).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith(quizQuestions.status, "approved");
  });

  it("finds top valid user tags by count and recency", async () => {
    const { db } = createFakeTopTagsDb([
      { tag: "particle_object" },
      { tag: "not_allowed" },
      { tag: "spacing" },
    ]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.findTopUserTags("11111111-1111-4111-8111-111111111111"),
    ).resolves.toEqual(["particle_object", "spacing"]);
    expect(eq).toHaveBeenCalled();
    expect(desc).toHaveBeenCalledTimes(2);
  });

  it("returns per-question attempt summaries for the current user", async () => {
    const rows = [
      {
        quizId: "11111111-1111-4111-8111-111111111111",
        attemptCount: 3,
        correctCount: 2,
        lastAttemptCorrect: true,
        lastAttemptedAt: new Date("2026-07-21T00:00:00.000Z"),
      },
    ];
    const { db, query } = createFakeAttemptSummariesDb(rows);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.findQuizAttemptSummaries(
        "44444444-4444-4444-8444-444444444444",
      ),
    ).resolves.toEqual(rows);
    expect(eq).toHaveBeenCalledWith(
      quizAttempts.userId,
      "44444444-4444-4444-8444-444444444444",
    );
    expect(query.groupBy).toHaveBeenCalledWith(quizAttempts.quizQuestionId);
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
        contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
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

  it("skips quiz drafts whose content fingerprint already exists", async () => {
    const { db, insertedChoices } = createFakeDraftDb([[]]);
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
    ).resolves.toEqual([]);
    expect(insertedChoices).toEqual([]);
  });

  it("stores only one copy of duplicate questions in the same batch", async () => {
    const question = {
      tag: "particle_object" as const,
      difficulty: "beginner" as const,
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
    };
    const { db, insertedChoices } = createFakeDraftDb([
      [{ id: "11111111-1111-4111-8111-111111111111" }],
      [],
    ]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.createQuizDrafts({ questions: [question, question] }),
    ).resolves.toEqual([
      {
        id: "11111111-1111-4111-8111-111111111111",
        ...question,
      },
    ]);
    expect(insertedChoices).toHaveLength(1);
  });

  it("updates quiz review fields and replaces choices", async () => {
    const now = new Date("2026-07-09T00:00:00.000Z");
    const { db, updateSet, deletedChoices, insertedChoices, lockForUpdate } =
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
        contentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
        status: "approved",
        updatedAt: now,
      },
    ]);
    expect(lockForUpdate).toHaveBeenCalledWith("update");
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

  it("deletes only a matching draft quiz", async () => {
    const { db } = createFakeDeleteDraftDb([
      { id: "11111111-1111-4111-8111-111111111111" },
    ]);
    const repository = createQuizRepository(db as never);

    await expect(
      repository.deleteQuizDraft("11111111-1111-4111-8111-111111111111"),
    ).resolves.toBe(true);
    expect(eq).toHaveBeenCalledWith(quizQuestions.status, "draft");
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

  it("returns a duplicate conflict for a content fingerprint collision", async () => {
    const db = {
      transaction: vi.fn(async () => {
        throw Object.assign(new Error("duplicate key"), {
          code: "23505",
          constraint_name: "quiz_questions_active_fingerprint_unique",
        });
      }),
    };
    const repository = createQuizRepository(db as never);

    await expect(
      repository.updateQuiz({
        id: "11111111-1111-4111-8111-111111111111",
        now: new Date("2026-07-09T00:00:00.000Z"),
        update: { sentenceKo: "저는 사과( ) 먹어요." },
      }),
    ).resolves.toEqual({ code: "quiz_duplicate" });
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
