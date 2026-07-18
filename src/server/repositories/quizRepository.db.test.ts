import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createDbConnection } from "@/server/db";
import { quizChoices, quizQuestions } from "@/server/db/schema";
import { createQuizContentFingerprint } from "@/server/quizContentFingerprint";
import { createQuizRepository } from "./quizRepository";

loadEnvConfig(process.cwd());

const describeWithDatabase =
  process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeWithDatabase("quizRepository database concurrency", () => {
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
