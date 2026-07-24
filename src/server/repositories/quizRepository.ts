import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { UserLevelSchema } from "@/lib/contracts/common";
import {
  GrammarTagSchema,
  type GrammarTag,
} from "@/lib/contracts/grammar-tags";
import { QuizStatusSchema } from "@/lib/contracts/quiz";
import type {
  AdminQuizDraft,
  AdminQuizUpdateRequest,
  QuizStatus,
  QuizDraftOutput,
  QuizAttemptResponse,
  RecommendedQuiz,
} from "@/lib/contracts/quiz";
import type { Db } from "@/server/db";
import {
  quizAttempts,
  quizChoices,
  quizQuestions,
  userTagStats,
} from "@/server/db/schema";
import { createQuizContentFingerprint } from "@/server/quizContentFingerprint";

export type QuizRepository = {
  findApprovedQuizzesByTags(tags: GrammarTag[]): Promise<RecommendedQuiz[]>;
  createQuizDrafts(input: CreateQuizDraftsInput): Promise<AdminQuizDraft[]>;
  deleteQuizDraft(id: string): Promise<boolean>;
  updateQuiz(
    input: UpdateQuizInput,
  ): Promise<UpdateQuizResult | UpdateQuizConflict | null>;
  recordQuizAttempt(
    input: RecordQuizAttemptInput,
  ): Promise<QuizAttemptResponse | RecordQuizAttemptConflict | null>;
  findQuizAttemptSummaries(userId: string): Promise<QuizAttemptSummary[]>;
  findTopUserTags(userId: string): Promise<GrammarTag[]>;
};

export type CreateQuizDraftsInput = {
  questions: QuizDraftOutput["questions"];
};

export type UpdateQuizInput = {
  id: string;
  update: AdminQuizUpdateRequest;
  now: Date;
};

export type UpdateQuizResult = {
  id: string;
  status: QuizStatus;
};

export type UpdateQuizConflict = {
  code: "quiz_choices_locked" | "quiz_duplicate";
};

export type RecordQuizAttemptInput = {
  userId: string;
  quizId: string;
  selectedChoiceId: string;
};

export type RecordQuizAttemptConflict = {
  code: "invalid_choice";
};

export type QuizAttemptSummary = {
  quizId: string;
  attemptCount: number;
  correctCount: number;
  lastAttemptCorrect: boolean;
  lastAttemptedAt: Date;
};

export function createQuizRepository(db: Db): QuizRepository {
  return {
    findApprovedQuizzesByTags: (tags) => findApprovedQuizzesByTags(db, tags),
    createQuizDrafts: (input) => createQuizDrafts(db, input),
    deleteQuizDraft: (id) => deleteQuizDraft(db, id),
    updateQuiz: (input) => updateQuiz(db, input),
    recordQuizAttempt: (input) => recordQuizAttempt(db, input),
    findQuizAttemptSummaries: (userId) => findQuizAttemptSummaries(db, userId),
    findTopUserTags: (userId) => findTopUserTags(db, userId),
  };
}

async function findQuizAttemptSummaries(db: Db, userId: string) {
  return db
    .select({
      quizId: quizAttempts.quizQuestionId,
      attemptCount: sql<number>`count(*)::int`,
      correctCount: sql<number>`count(*) filter (where ${quizAttempts.isCorrect})::int`,
      lastAttemptCorrect: sql<boolean>`(array_agg(${quizAttempts.isCorrect} order by ${quizAttempts.createdAt} desc, ${quizAttempts.id} desc))[1]`,
      lastAttemptedAt: sql<Date>`max(${quizAttempts.createdAt})`.mapWith(
        quizAttempts.createdAt,
      ),
    })
    .from(quizAttempts)
    .where(eq(quizAttempts.userId, userId))
    .groupBy(quizAttempts.quizQuestionId);
}

async function deleteQuizDraft(db: Db, id: string) {
  const [deleted] = await db
    .delete(quizQuestions)
    .where(and(eq(quizQuestions.id, id), eq(quizQuestions.status, "draft")))
    .returning({ id: quizQuestions.id });

  return deleted !== undefined;
}

async function findTopUserTags(db: Db, userId: string) {
  const rows = await db
    .select({ tag: userTagStats.tag })
    .from(userTagStats)
    .where(eq(userTagStats.userId, userId))
    .orderBy(desc(userTagStats.count), desc(userTagStats.lastSeenAt));

  return rows
    .map((row) => GrammarTagSchema.safeParse(row.tag))
    .filter((tag) => tag.success)
    .map((tag) => tag.data);
}

async function recordQuizAttempt(db: Db, input: RecordQuizAttemptInput) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        quizId: quizQuestions.id,
        answerExplanationEn: quizQuestions.answerExplanationEn,
        choiceId: quizChoices.id,
        isCorrect: quizChoices.isCorrect,
      })
      .from(quizQuestions)
      .innerJoin(quizChoices, eq(quizChoices.quizQuestionId, quizQuestions.id))
      .where(
        and(
          eq(quizQuestions.id, input.quizId),
          eq(quizQuestions.status, "approved"),
        ),
      );

    if (rows.length === 0) {
      return null;
    }

    const selectedChoice = rows.find(
      (choice) => choice.choiceId === input.selectedChoiceId,
    );
    if (!selectedChoice) {
      return { code: "invalid_choice" } as const;
    }

    const correctChoice = rows.find((choice) => choice.isCorrect);
    if (!correctChoice) {
      throw new Error("Approved quiz has no correct choice.");
    }

    await tx.insert(quizAttempts).values({
      userId: input.userId,
      quizQuestionId: input.quizId,
      selectedChoiceId: input.selectedChoiceId,
      isCorrect: selectedChoice.isCorrect,
    });

    return {
      isCorrect: selectedChoice.isCorrect,
      correctChoiceId: correctChoice.choiceId,
      explanationEn: rows[0].answerExplanationEn,
    };
  });
}

async function updateQuiz(db: Db, input: UpdateQuizInput) {
  try {
    return await db.transaction(async (tx) => {
      const [lockedQuiz] = await tx
        .select({ id: quizQuestions.id })
        .from(quizQuestions)
        .where(eq(quizQuestions.id, input.id))
        .for("update");

      if (!lockedQuiz) {
        return null;
      }

      if (input.update.choices) {
        const attempted = await tx
          .select({ id: quizAttempts.id })
          .from(quizAttempts)
          .where(eq(quizAttempts.quizQuestionId, input.id))
          .limit(1);

        if (attempted.length > 0) {
          return { code: "quiz_choices_locked" } as const;
        }
      }

      const contentFingerprint = await getUpdatedContentFingerprint(tx, input);
      if (contentFingerprint === null) {
        return null;
      }

      const [updated] = await tx
        .update(quizQuestions)
        .set({
          ...toQuizQuestionUpdate(input.update),
          ...(contentFingerprint ? { contentFingerprint } : {}),
          updatedAt: input.now,
        })
        .where(eq(quizQuestions.id, input.id))
        .returning({
          id: quizQuestions.id,
          status: quizQuestions.status,
        });

      if (!updated) {
        return null;
      }

      if (input.update.choices) {
        await tx
          .delete(quizChoices)
          .where(eq(quizChoices.quizQuestionId, input.id));
        await tx.insert(quizChoices).values(
          input.update.choices.map((choice) => ({
            ...(choice.id ? { id: choice.id } : {}),
            quizQuestionId: input.id,
            choiceText: choice.text,
            isCorrect: choice.isCorrect,
            sortOrder: choice.sortOrder,
          })),
        );
      }

      return {
        id: updated.id,
        status: QuizStatusSchema.parse(updated.status),
      };
    });
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      return { code: "quiz_duplicate" } as const;
    }

    throw error;
  }
}

async function getUpdatedContentFingerprint(
  tx: Parameters<Parameters<Db["transaction"]>[0]>[0],
  input: UpdateQuizInput,
) {
  const updatesContent =
    input.update.tag !== undefined ||
    input.update.difficulty !== undefined ||
    input.update.sentenceKo !== undefined ||
    input.update.choices !== undefined;

  if (!updatesContent) {
    return undefined;
  }

  const rows = await tx
    .select({
      tag: quizQuestions.tag,
      difficulty: quizQuestions.difficulty,
      sentenceKo: quizQuestions.sentenceKo,
      choiceText: quizChoices.choiceText,
      isCorrect: quizChoices.isCorrect,
    })
    .from(quizQuestions)
    .innerJoin(quizChoices, eq(quizChoices.quizQuestionId, quizQuestions.id))
    .where(eq(quizQuestions.id, input.id));

  const current = rows[0];
  if (!current) {
    return null;
  }

  return createQuizContentFingerprint({
    tag: input.update.tag ?? current.tag,
    difficulty: input.update.difficulty ?? current.difficulty,
    sentenceKo: input.update.sentenceKo ?? current.sentenceKo,
    choices:
      input.update.choices ??
      rows.map((row) => ({
        text: row.choiceText,
        isCorrect: row.isCorrect,
      })),
  });
}

function isUniqueConstraintViolation(error: unknown) {
  const duplicateQuizConstraints = new Set([
    "quiz_questions_content_fingerprint_unique",
    "quiz_questions_active_fingerprint_unique",
    "quiz_questions_revision_target_unique",
  ]);

  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505" &&
    "constraint_name" in error &&
    typeof error.constraint_name === "string" &&
    duplicateQuizConstraints.has(error.constraint_name)
  );
}

function toQuizQuestionUpdate(update: AdminQuizUpdateRequest) {
  return {
    ...(update.tag !== undefined ? { tag: update.tag } : {}),
    ...(update.difficulty !== undefined
      ? { difficulty: update.difficulty }
      : {}),
    ...(update.questionEn !== undefined
      ? { questionEn: update.questionEn }
      : {}),
    ...(update.sentenceKo !== undefined
      ? { sentenceKo: update.sentenceKo }
      : {}),
    ...(update.answerExplanationEn !== undefined
      ? { answerExplanationEn: update.answerExplanationEn }
      : {}),
    ...(update.status !== undefined ? { status: update.status } : {}),
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
          contentFingerprint: createQuizContentFingerprint(question),
          status: "draft",
          questionEn: question.questionEn,
          sentenceKo: question.sentenceKo,
          answerExplanationEn: question.answerExplanationEn,
          source: "ai_draft",
        })
        .onConflictDoNothing()
        .returning({ id: quizQuestions.id });

      if (!draft) {
        continue;
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
      tags.length
        ? and(
            eq(quizQuestions.status, "approved"),
            inArray(quizQuestions.tag, tags),
          )
        : eq(quizQuestions.status, "approved"),
    )
    .orderBy(asc(quizQuestions.createdAt), asc(quizChoices.sortOrder));

  const quizzes = new Map<string, RecommendedQuiz>();

  for (const row of rows) {
    const quiz = quizzes.get(row.quizId) ?? {
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
