import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { quizChoices, quizQuestions } from "@/server/db/schema";
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
});
