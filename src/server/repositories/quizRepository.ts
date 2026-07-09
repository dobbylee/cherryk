import { and, asc, eq, inArray } from "drizzle-orm";
import { UserLevelSchema } from "@/lib/contracts/common";
import { GrammarTagSchema, type GrammarTag } from "@/lib/contracts/grammar-tags";
import type { RecommendedQuiz } from "@/lib/contracts/quiz";
import type { Db } from "@/server/db";
import { quizChoices, quizQuestions } from "@/server/db/schema";

export type QuizRepository = {
  findApprovedQuizzesByTags(tags: GrammarTag[]): Promise<RecommendedQuiz[]>;
};

export function createQuizRepository(db: Db): QuizRepository {
  return {
    findApprovedQuizzesByTags: (tags) => findApprovedQuizzesByTags(db, tags),
  };
}

async function findApprovedQuizzesByTags(db: Db, tags: GrammarTag[]) {
  if (tags.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      quizId: quizQuestions.id,
      tag: quizQuestions.tag,
      difficulty: quizQuestions.difficulty,
      questionEn: quizQuestions.questionEn,
      sentenceKo: quizQuestions.sentenceKo,
      choiceId: quizChoices.id,
      choiceText: quizChoices.choiceText,
    })
    .from(quizQuestions)
    .innerJoin(quizChoices, eq(quizChoices.quizQuestionId, quizQuestions.id))
    .where(
      and(
        eq(quizQuestions.status, "approved"),
        inArray(quizQuestions.tag, tags),
      ),
    )
    .orderBy(asc(quizQuestions.createdAt), asc(quizChoices.sortOrder));

  const quizzes = new Map<string, RecommendedQuiz>();

  for (const row of rows) {
    const quiz =
      quizzes.get(row.quizId) ??
      {
        id: row.quizId,
        tag: GrammarTagSchema.parse(row.tag),
        difficulty: UserLevelSchema.parse(row.difficulty),
        questionEn: row.questionEn,
        sentenceKo: row.sentenceKo,
        choices: [],
      };

    quiz.choices.push({
      id: row.choiceId,
      text: row.choiceText,
    });
    quizzes.set(row.quizId, quiz);
  }

  return Array.from(quizzes.values()).filter(
    (quiz) => quiz.choices.length === 4,
  );
}
