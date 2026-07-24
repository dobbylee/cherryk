import { loadEnvConfig } from "@next/env";
import { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDbConnection } from "@/server/db";
import * as schema from "@/server/db/schema";
import {
  quizAttempts,
  quizChoices,
  quizQuestions,
  users,
} from "@/server/db/schema";
import { createQuizContentFingerprint } from "@/server/quizContentFingerprint";
import { createQuizRepository } from "./quizRepository";

loadEnvConfig(process.cwd());

const describeWithDatabase =
  process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describe("quizRepository attempt summary integration", () => {
  it("runs the aggregate query against Postgres", async () => {
    const client = new PGlite();
    const userId = "11111111-1111-4111-8111-111111111111";
    const quizId = "22222222-2222-4222-8222-222222222222";

    try {
      await client.exec(`
        CREATE TABLE quiz_attempts (
          id uuid PRIMARY KEY,
          user_id uuid NOT NULL,
          quiz_question_id uuid NOT NULL,
          selected_choice_id uuid NOT NULL,
          is_correct boolean NOT NULL,
          created_at timestamptz NOT NULL
        );

        INSERT INTO quiz_attempts (
          id,
          user_id,
          quiz_question_id,
          selected_choice_id,
          is_correct,
          created_at
        ) VALUES
          (
            '33333333-3333-4333-8333-333333333333',
            '${userId}',
            '${quizId}',
            '55555555-5555-4555-8555-555555555555',
            false,
            '2026-07-20T00:00:00.000Z'
          ),
          (
            '44444444-4444-4444-8444-444444444444',
            '${userId}',
            '${quizId}',
            '66666666-6666-4666-8666-666666666666',
            true,
            '2026-07-21T00:00:00.000Z'
          );
      `);
      const repository = createQuizRepository(
        drizzle(client, { schema }) as never,
      );

      await expect(
        repository.findQuizAttemptSummaries(userId),
      ).resolves.toEqual([
        {
          quizId,
          attemptCount: 2,
          correctCount: 1,
          lastAttemptCorrect: true,
          lastAttemptedAt: new Date("2026-07-21T00:00:00.000Z"),
        },
      ]);
    } finally {
      await client.close();
    }
  });
});

describeWithDatabase("quizRepository database concurrency", () => {
  it("aggregates attempt counts and the latest result per quiz", async () => {
    const connection = createDbConnection(
      process.env.DATABASE_URL ??
        "postgres://cherryk:cherryk@localhost:5433/cherryk",
    );
    const repository = createQuizRepository(connection.db);
    const marker = randomUUID();
    const userId = randomUUID();
    const quizId = randomUUID();
    const incorrectChoiceId = randomUUID();
    const correctChoiceId = randomUUID();

    try {
      await connection.db.insert(users).values({
        id: userId,
        displayName: "Attempt summary test",
        email: `${marker}@example.com`,
      });
      await connection.db.insert(quizQuestions).values({
        id: quizId,
        tag: "particle_object",
        difficulty: "beginner",
        contentFingerprint: `attempt-summary-${marker}`,
        status: "approved",
        questionEn: "Choose the correct particle.",
        sentenceKo: `집계 테스트 ${marker}`,
        answerExplanationEn: "Database attempt summary test.",
      });
      await connection.db.insert(quizChoices).values([
        {
          id: incorrectChoiceId,
          quizQuestionId: quizId,
          choiceText: "은",
          isCorrect: false,
          sortOrder: 0,
        },
        {
          id: correctChoiceId,
          quizQuestionId: quizId,
          choiceText: "를",
          isCorrect: true,
          sortOrder: 1,
        },
        {
          quizQuestionId: quizId,
          choiceText: "에",
          isCorrect: false,
          sortOrder: 2,
        },
        {
          quizQuestionId: quizId,
          choiceText: "이",
          isCorrect: false,
          sortOrder: 3,
        },
      ]);
      await connection.db.insert(quizAttempts).values([
        {
          userId,
          quizQuestionId: quizId,
          selectedChoiceId: incorrectChoiceId,
          isCorrect: false,
          createdAt: new Date("2026-07-20T00:00:00.000Z"),
        },
        {
          userId,
          quizQuestionId: quizId,
          selectedChoiceId: correctChoiceId,
          isCorrect: true,
          createdAt: new Date("2026-07-21T00:00:00.000Z"),
        },
      ]);

      await expect(
        repository.findQuizAttemptSummaries(userId),
      ).resolves.toEqual([
        {
          quizId,
          attemptCount: 2,
          correctCount: 1,
          lastAttemptCorrect: true,
          lastAttemptedAt: new Date("2026-07-21T00:00:00.000Z"),
        },
      ]);
    } finally {
      await connection.db.delete(users).where(eq(users.id, userId));
      await connection.db
        .delete(quizQuestions)
        .where(eq(quizQuestions.id, quizId));
      await connection.close();
    }
  });

  it("keeps the fingerprint aligned with concurrent content edits", async () => {
    const connection = createDbConnection(
      process.env.DATABASE_URL ??
        "postgres://cherryk:cherryk@localhost:5433/cherryk",
    );
    const repository = createQuizRepository(connection.db);
    const marker = randomUUID();
    let draftId: string | null = null;
    const initialQuestion = {
      tag: "particle_object" as const,
      difficulty: "beginner" as const,
      questionEn: "Choose the correct particle.",
      sentenceKo: `동시성 테스트 ${marker}( ) 읽어요.`,
      choices: [
        { text: `은-${marker}`, isCorrect: false },
        { text: `를-${marker}`, isCorrect: true },
        { text: `에-${marker}`, isCorrect: false },
        { text: `이-${marker}`, isCorrect: false },
      ],
      answerExplanationEn: "Database concurrency test.",
    };

    try {
      const [draft] = await repository.createQuizDrafts({
        questions: [initialQuestion],
      });
      expect(draft).toBeDefined();
      if (!draft) {
        return;
      }
      draftId = draft.id;

      const replacementChoices = initialQuestion.choices.map(
        (choice, index) => ({
          text: `${choice.text}-updated`,
          isCorrect: choice.isCorrect,
          sortOrder: index,
        }),
      );

      await Promise.all([
        repository.updateQuiz({
          id: draft.id,
          update: {
            sentenceKo: `수정된 동시성 테스트 ${marker}( ) 읽어요.`,
          },
          now: new Date(),
        }),
        repository.updateQuiz({
          id: draft.id,
          update: { choices: replacementChoices },
          now: new Date(),
        }),
      ]);

      const storedRows = await connection.db
        .select({
          tag: quizQuestions.tag,
          difficulty: quizQuestions.difficulty,
          sentenceKo: quizQuestions.sentenceKo,
          contentFingerprint: quizQuestions.contentFingerprint,
          choiceText: quizChoices.choiceText,
          isCorrect: quizChoices.isCorrect,
        })
        .from(quizQuestions)
        .innerJoin(
          quizChoices,
          eq(quizChoices.quizQuestionId, quizQuestions.id),
        )
        .where(eq(quizQuestions.id, draft.id));

      expect(storedRows).toHaveLength(4);
      expect(storedRows[0]?.contentFingerprint).toBe(
        createQuizContentFingerprint({
          tag: storedRows[0]?.tag ?? "",
          difficulty: storedRows[0]?.difficulty ?? "",
          sentenceKo: storedRows[0]?.sentenceKo ?? "",
          choices: storedRows.map((row) => ({
            text: row.choiceText,
            isCorrect: row.isCorrect,
          })),
        }),
      );
    } finally {
      if (draftId) {
        await connection.db
          .delete(quizQuestions)
          .where(eq(quizQuestions.id, draftId));
      }
      await connection.close();
    }
  });
});
