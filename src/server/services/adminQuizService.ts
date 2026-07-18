import {
  AdminQuizDeleteResponseSchema,
  AdminQuizDraftGenerationResponseSchema,
  AdminQuizUpdateResponseSchema,
  QuizDraftOutputSchema,
  type AdminQuizDeleteResponse,
  type AdminQuizDraftGenerationResponse,
  type AdminQuizUpdateRequest,
  type AdminQuizUpdateResponse,
  type QuizDraftInput,
} from "@/lib/contracts/quiz";
import type { AIProvider } from "@/server/ai/provider";
import type { QuizRepository } from "@/server/repositories/quizRepository";

export class AdminQuizServiceError extends Error {
  constructor(
    readonly code:
      | "invalid_ai_output"
      | "quiz_not_found"
      | "quiz_choices_locked"
      | "quiz_duplicate",
    message: string,
  ) {
    super(message);
    this.name = "AdminQuizServiceError";
  }
}

export function createAdminQuizService(
  repository: QuizRepository,
  aiProvider: AIProvider,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());

  return {
    async generateDrafts(
      input: QuizDraftInput,
    ): Promise<AdminQuizDraftGenerationResponse> {
      const aiResult = await aiProvider.generateQuizDrafts(input);
      const parsed = QuizDraftOutputSchema.safeParse(aiResult);

      if (
        !parsed.success ||
        parsed.data.questions.length !== input.count ||
        !matchesRequestedTopic(parsed.data, input)
      ) {
        throw new AdminQuizServiceError(
          "invalid_ai_output",
          "AI quiz draft output is invalid.",
        );
      }

      const drafts = await repository.createQuizDrafts({
        questions: parsed.data.questions,
      });

      return AdminQuizDraftGenerationResponseSchema.parse({ drafts });
    },

    async updateQuiz(
      id: string,
      update: AdminQuizUpdateRequest,
    ): Promise<AdminQuizUpdateResponse> {
      const result = await repository.updateQuiz({
        id,
        update,
        now: now(),
      });

      if (!result) {
        throw new AdminQuizServiceError(
          "quiz_not_found",
          "Quiz was not found.",
        );
      }

      if ("code" in result) {
        throw new AdminQuizServiceError(
          result.code,
          result.code === "quiz_duplicate"
            ? "An identical quiz already exists."
            : "Quiz choices cannot be replaced after attempts exist.",
        );
      }

      return AdminQuizUpdateResponseSchema.parse({
        quiz: result,
      });
    },

    async deleteDraft(id: string): Promise<AdminQuizDeleteResponse> {
      const deleted = await repository.deleteQuizDraft(id);
      if (!deleted) {
        throw new AdminQuizServiceError(
          "quiz_not_found",
          "Quiz draft was not found.",
        );
      }

      return AdminQuizDeleteResponseSchema.parse({ deletedQuizId: id });
    },
  };
}

function matchesRequestedTopic(
  output: { questions: { tag: string; difficulty: string }[] },
  input: QuizDraftInput,
) {
  return output.questions.every(
    (question) =>
      question.tag === input.tag && question.difficulty === input.difficulty,
  );
}
