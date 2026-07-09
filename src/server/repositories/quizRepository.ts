import { and, asc, eq, inArray } from "drizzle-orm";
import { UserLevelSchema } from "@/lib/contracts/common";
import { GrammarTagSchema, type GrammarTag } from "@/lib/contracts/grammar-tags";
import type {
  AdminQuizDraft,
  QuizDraftOutput,
  RecommendedQuiz,
} from "@/lib/contracts/quiz";
import type { Db } from "@/server/db";
import { quizChoices, quizQuestions } from "@/server/db/schema";

export type QuizRepository = {
  findApprovedQuizzesByTags(tags: GrammarTag[]): Promise<RecommendedQuiz[]>;
  createQuizDrafts(input: CreateQuizDraftsInput): Promise<AdminQuizDraft[]>;
};

export type CreateQuizDraftsInput = {
  questions: QuizDraftOutput["questions"];
};

export function createQuizRepository(db: Db): QuizRepository {
  return {
    findApprovedQuizzesByTags: (tags) => findApprovedQuizzesByTags(db, tags),
    createQuizDrafts: (input) => createQuizDrafts(db, input),
  };
}

async function createQuizDrafts(db: Db, input: CreateQuizDraftsInput) {
  return db.transaction(async (tx) => {
    const drafts: AdminQuizDraft[] = [];

    for (const question of input.questions) {
      const [draft] = await tx
        .insert(quizQuestions)
        .values({
          tag: question.tag,
          difficulty: question.difficulty,
          status: "draft",
          questionEn: question.questionEn,
          sentenceKo: question.sentenceKo,
          answerExplanationEn: question.answerExplanationEn,
          source: "ai_draft",
        })
        .returning({ id: quizQuestions.id });

      if (!draft) {
        throw new Error("Failed to create quiz draft.");
      }

      await tx.insert(quizChoices).values(
        question.choices.map((choice, index) => ({
          quizQuestionId: draft.id,
          choiceText: choice.text,
          isCorrect: choice.isCorrect,
          sortOrder: index,
        })),
      );

      drafts.push({
        id: draft.id,
        ...question,
      });
    }

    return drafts;
  });
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
