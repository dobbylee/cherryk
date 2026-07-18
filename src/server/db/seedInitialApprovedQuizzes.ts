import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";
import { createDbConnection, type Db } from "@/server/db";
import { quizChoices, quizQuestions } from "@/server/db/schema";
import { createQuizContentFingerprint } from "@/server/quizContentFingerprint";
import { INITIAL_APPROVED_QUIZZES } from "./initialApprovedQuizzes";

loadEnvConfig(process.cwd());

export async function seedInitialApprovedQuizzes(db: Db) {
  let inserted = 0;

  await db.transaction(async (tx) => {
    for (const quiz of INITIAL_APPROVED_QUIZZES) {
      const existing = await tx
        .select({ id: quizQuestions.id })
        .from(quizQuestions)
        .where(eq(quizQuestions.id, quiz.id))
        .limit(1);

      if (existing.length > 0) {
        continue;
      }

      const [insertedQuiz] = await tx
        .insert(quizQuestions)
        .values({
          id: quiz.id,
          tag: quiz.tag,
          difficulty: quiz.difficulty,
          contentFingerprint: createQuizContentFingerprint(quiz),
          status: "approved",
          questionEn: quiz.questionEn,
          sentenceKo: quiz.sentenceKo,
          answerExplanationEn: quiz.answerExplanationEn,
          source: "seed",
        })
        .onConflictDoNothing({ target: quizQuestions.contentFingerprint })
        .returning({ id: quizQuestions.id });

      if (!insertedQuiz) {
        continue;
      }

      await tx.insert(quizChoices).values(
        quiz.choices.map((choice, index) => ({
          id: choice.id,
          quizQuestionId: quiz.id,
          choiceText: choice.text,
          isCorrect: choice.isCorrect,
          sortOrder: index,
        })),
      );
      inserted += 1;
    }
  });

  return {
    inserted,
    skipped: INITIAL_APPROVED_QUIZZES.length - inserted,
  };
}

async function main() {
  const connection = createDbConnection();

  try {
    const result = await seedInitialApprovedQuizzes(connection.db);

    console.log(
      `Seeded ${result.inserted} approved quizzes; skipped ${result.skipped}.`,
    );
  } finally {
    await connection.close();
  }
}

if (process.env.NODE_ENV !== "test") {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
