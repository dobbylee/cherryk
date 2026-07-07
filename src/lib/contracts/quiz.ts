import { z } from "zod";
import { UserLevelSchema } from "./common";
import { GrammarTagSchema } from "./grammar-tags";

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

export type QuizStatus = z.infer<typeof QuizStatusSchema>;
export type QuizDraftInput = z.infer<typeof QuizDraftInputSchema>;
export type QuizDraftOutput = z.infer<typeof QuizDraftOutputSchema>;
