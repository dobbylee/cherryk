import {
  AdminQuizDraftGenerationResponseSchema,
  QuizDraftOutputSchema,
  type AdminQuizDraftGenerationResponse,
  type QuizDraftInput,
} from "@/lib/contracts/quiz";
import type { AIProvider } from "@/server/ai/provider";
import type { QuizRepository } from "@/server/repositories/quizRepository";

export class AdminQuizServiceError extends Error {
  constructor(
    readonly code: "invalid_ai_output",
    message: string,
  ) {
    super(message);
    this.name = "AdminQuizServiceError";
  }
}

export function createAdminQuizService(
  repository: QuizRepository,
  aiProvider: AIProvider,
) {
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
