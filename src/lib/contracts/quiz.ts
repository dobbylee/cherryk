import { z } from "zod";
import { EntityIdSchema, UserLevelSchema } from "./common";
import { GrammarTagSchema, GrammarTags } from "./grammar-tags";

export const QuizStatusSchema = z.enum(["draft", "approved"]);

export const QuizDraftInputSchema = z.object({
  tag: GrammarTagSchema,
  difficulty: UserLevelSchema,
  count: z.number().int().min(1).max(20),
  instruction: z.string().trim().max(1000).optional(),
});

export const QuizChoiceDraftSchema = z.object({
  text: z.string().trim().min(1),
  isCorrect: z.boolean(),
});

export const QuizDraftQuestionSchema = z.object({
  tag: GrammarTagSchema,
  difficulty: UserLevelSchema,
  questionEn: z.string().trim().min(1),
  sentenceKo: z.string().trim().min(1),
  choices: z.array(QuizChoiceDraftSchema).length(4),
  answerExplanationEn: z.string().trim().min(1),
});

export const QuizRecommendationQuerySchema = z.object({
  tags: z.array(GrammarTagSchema).max(GrammarTags.length).default([]),
});

export const RecommendedQuizChoiceSchema = z.object({
  id: EntityIdSchema,
  text: z.string().trim().min(1),
});

export const RecommendedQuizSchema = z.object({
  id: EntityIdSchema,
  tag: GrammarTagSchema,
  difficulty: UserLevelSchema,
  questionEn: z.string().trim().min(1),
  sentenceKo: z.string().trim().min(1),
  choices: z.array(RecommendedQuizChoiceSchema).length(4),
});

export const QuizPracticeItemSchema = RecommendedQuizSchema.extend({
  attemptCount: z.number().int().nonnegative(),
});

export const QuizProgressSchema = z
  .object({
    solvedCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
    attemptCount: z.number().int().nonnegative(),
    correctCount: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (value.solvedCount > value.totalCount) {
      ctx.addIssue({
        code: "custom",
        path: ["solvedCount"],
        message: "Solved quiz count cannot exceed the approved quiz count.",
      });
    }

    if (value.correctCount > value.attemptCount) {
      ctx.addIssue({
        code: "custom",
        path: ["correctCount"],
        message: "Correct attempt count cannot exceed the attempt count.",
      });
    }
  });

export const QuizRecommendationResponseSchema = z.object({
  quizzes: z.array(QuizPracticeItemSchema).max(5),
  availableTags: z.array(GrammarTagSchema),
  activeTags: z.array(GrammarTagSchema),
  progress: QuizProgressSchema,
});

export const QuizAttemptRequestSchema = z.object({
  quizId: EntityIdSchema,
  selectedChoiceId: EntityIdSchema,
});

export const QuizAttemptResponseSchema = z.object({
  isCorrect: z.boolean(),
  correctChoiceId: EntityIdSchema,
  explanationEn: z.string().trim().min(1),
});

export const AdminQuizDraftChoiceSchema = QuizChoiceDraftSchema;

export const AdminQuizDraftSchema = QuizDraftQuestionSchema.extend({
  id: EntityIdSchema,
});

export const AdminQuizDraftGenerationResponseSchema = z
  .object({
    drafts: z.array(AdminQuizDraftSchema),
  })
  .superRefine((value, ctx) => {
    value.drafts.forEach((draft, index) => {
      const correctCount = draft.choices.filter(
        (choice) => choice.isCorrect,
      ).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["drafts", index, "choices"],
          message: "Quiz drafts must have exactly one correct choice.",
        });
      }
    });
  });

export const AdminQuizChoiceUpdateSchema = z
  .object({
    text: z.string().trim().min(1),
    isCorrect: z.boolean(),
    sortOrder: z.number().int().min(0).max(3),
  })
  .strict();

export const AdminQuizUpdateRequestSchema = z
  .object({
    tag: GrammarTagSchema.optional(),
    difficulty: UserLevelSchema.optional(),
    questionEn: z.string().trim().min(1).optional(),
    sentenceKo: z.string().trim().min(1).optional(),
    choices: z.array(AdminQuizChoiceUpdateSchema).length(4).optional(),
    answerExplanationEn: z.string().trim().min(1).optional(),
    status: QuizStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (Object.keys(value).length === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Quiz update request must include at least one change.",
      });
    }

    if (value.choices) {
      const correctCount = value.choices.filter(
        (choice) => choice.isCorrect,
      ).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["choices"],
          message: "Quiz updates must have exactly one correct choice.",
        });
      }

      const sortOrders = new Set(
        value.choices.map((choice) => choice.sortOrder),
      );
      if (sortOrders.size !== value.choices.length) {
        ctx.addIssue({
          code: "custom",
          path: ["choices"],
          message: "Quiz update choices must have unique sortOrder values.",
        });
      }
    }
  });

export const AdminQuizUpdateResponseSchema = z.object({
  quiz: z.object({
    id: EntityIdSchema,
    status: QuizStatusSchema,
  }),
});

export const AdminQuizDeleteResponseSchema = z.object({
  deletedQuizId: EntityIdSchema,
});

export type QuizStatus = z.infer<typeof QuizStatusSchema>;
export type QuizDraftInput = z.infer<typeof QuizDraftInputSchema>;
export type QuizRecommendationQuery = z.infer<
  typeof QuizRecommendationQuerySchema
>;
export type RecommendedQuiz = z.infer<typeof RecommendedQuizSchema>;
export type QuizPracticeItem = z.infer<typeof QuizPracticeItemSchema>;
export type QuizProgress = z.infer<typeof QuizProgressSchema>;
export type QuizRecommendationResponse = z.infer<
  typeof QuizRecommendationResponseSchema
>;
export type QuizAttemptRequest = z.infer<typeof QuizAttemptRequestSchema>;
export type QuizAttemptResponse = z.infer<typeof QuizAttemptResponseSchema>;
export type AdminQuizDraft = z.infer<typeof AdminQuizDraftSchema>;
export type AdminQuizDraftGenerationResponse = z.infer<
  typeof AdminQuizDraftGenerationResponseSchema
>;
export type AdminQuizUpdateRequest = z.infer<
  typeof AdminQuizUpdateRequestSchema
>;
export type AdminQuizUpdateResponse = z.infer<
  typeof AdminQuizUpdateResponseSchema
>;
export type AdminQuizDeleteResponse = z.infer<
  typeof AdminQuizDeleteResponseSchema
>;
