import { z } from "zod";
import { UserLevelSchema } from "./common";
import { GrammarTagSchema, GrammarTags } from "./grammar-tags";

export const QuizStatusSchema = z.enum(["draft", "approved", "rejected"]);

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

export const QuizDraftOutputSchema = z
  .object({
    questions: z.array(QuizDraftQuestionSchema),
  })
  .superRefine((value, ctx) => {
    value.questions.forEach((question, index) => {
      const correctCount = question.choices.filter(
        (choice) => choice.isCorrect,
      ).length;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: "custom",
          path: ["questions", index, "choices"],
          message: "Quiz questions must have exactly one correct choice.",
        });
      }
    });
  });

export const QuizRecommendationQuerySchema = z.object({
  tags: z.array(GrammarTagSchema).max(GrammarTags.length).default([]),
});

export const RecommendedQuizChoiceSchema = z.object({
  id: z.uuid(),
  text: z.string().trim().min(1),
});

export const RecommendedQuizSchema = z.object({
  id: z.uuid(),
  tag: GrammarTagSchema,
  difficulty: UserLevelSchema,
  questionEn: z.string().trim().min(1),
  sentenceKo: z.string().trim().min(1),
  choices: z.array(RecommendedQuizChoiceSchema).length(4),
});

export const QuizRecommendationResponseSchema = z.object({
  quizzes: z.array(RecommendedQuizSchema),
});

export const AdminQuizDraftChoiceSchema = QuizChoiceDraftSchema;

export const AdminQuizDraftSchema = QuizDraftQuestionSchema.extend({
  id: z.uuid(),
});

export const AdminQuizDraftGenerationResponseSchema = z.object({
  drafts: z.array(AdminQuizDraftSchema),
});

export type QuizStatus = z.infer<typeof QuizStatusSchema>;
export type QuizDraftInput = z.infer<typeof QuizDraftInputSchema>;
export type QuizDraftOutput = z.infer<typeof QuizDraftOutputSchema>;
export type QuizRecommendationQuery = z.infer<
  typeof QuizRecommendationQuerySchema
>;
export type RecommendedQuiz = z.infer<typeof RecommendedQuizSchema>;
export type QuizRecommendationResponse = z.infer<
  typeof QuizRecommendationResponseSchema
>;
export type AdminQuizDraft = z.infer<typeof AdminQuizDraftSchema>;
export type AdminQuizDraftGenerationResponse = z.infer<
  typeof AdminQuizDraftGenerationResponseSchema
>;
