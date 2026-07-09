import { NextResponse } from "next/server";
import {
  QuizAttemptRequestSchema,
  type QuizAttemptResponse,
} from "@/lib/contracts/quiz";
import { requireCurrentUser } from "@/server/auth/currentUser";
import { createDb } from "@/server/db";
import { createQuizRepository } from "@/server/repositories/quizRepository";
import { AuthServiceError } from "@/server/services/authService";
import {
  createQuizAttemptService,
  QuizAttemptServiceError,
} from "@/server/services/quizAttemptService";
import { apiError } from "../../_responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userResult = await getAuthenticatedUser(request);
  if (userResult instanceof Response) {
    return userResult;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return apiError("invalid_request", "Request body must be JSON.", 400);
  }

  const parsed = QuizAttemptRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("invalid_request", "Quiz attempt request is invalid.", 400);
  }

  try {
    const service = createQuizAttemptService(createQuizRepository(createDb()));
    const response = await service.submitAttempt(userResult, parsed.data);

    return NextResponse.json<QuizAttemptResponse>(response);
  } catch (error) {
    if (error instanceof QuizAttemptServiceError) {
      return apiError(
        error.code,
        error.message,
        error.code === "quiz_not_available" ? 404 : 400,
      );
    }

    return apiError("server_error", "Quiz attempt is unavailable.", 500);
  }
}

async function getAuthenticatedUser(request: Request) {
  try {
    return await requireCurrentUser(request);
  } catch (error) {
    if (error instanceof AuthServiceError && error.code === "unauthorized") {
      return apiError(error.code, error.message, 401);
    }

    return apiError("server_error", "Authentication is unavailable.", 500);
  }
}
