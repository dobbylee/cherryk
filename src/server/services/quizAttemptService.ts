import type { AuthUser } from "@/lib/contracts/auth";
import type {
  QuizAttemptRequest,
  QuizAttemptResponse,
} from "@/lib/contracts/quiz";
import type { QuizRepository } from "@/server/repositories/quizRepository";

export class QuizAttemptServiceError extends Error {
  constructor(
    readonly code: "quiz_not_available" | "invalid_choice",
    message: string,
  ) {
    super(message);
    this.name = "QuizAttemptServiceError";
  }
}

export function createQuizAttemptService(repository: QuizRepository) {
  return {
    async submitAttempt(
      user: AuthUser,
      input: QuizAttemptRequest,
    ): Promise<QuizAttemptResponse> {
      const result = await repository.recordQuizAttempt({
        userId: user.id,
        quizId: input.quizId,
        selectedChoiceId: input.selectedChoiceId,
      });

      if (!result) {
        throw new QuizAttemptServiceError(
          "quiz_not_available",
          "Quiz is not available.",
        );
      }

      if ("code" in result) {
        throw new QuizAttemptServiceError(
          result.code,
          "Selected choice is invalid.",
        );
      }

      return result;
    },
  };
}
