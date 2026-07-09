import { NextResponse } from "next/server";
import {
  QuizDraftInputSchema,
  type AdminQuizDraftGenerationResponse,
} from "@/lib/contracts/quiz";
import { mockAIProvider } from "@/server/ai/mockAIProvider";
import { AdminAuthError, requireAdminSecret } from "@/server/auth/admin";
import { createDb } from "@/server/db";
import { createQuizRepository } from "@/server/repositories/quizRepository";
import {
  AdminQuizServiceError,
  createAdminQuizService,
} from "@/server/services/adminQuizService";
import { apiError } from "../../../_responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const adminResult = getAdminAccess(request);
  if (adminResult instanceof Response) {
    return adminResult;
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return apiError("invalid_request", "Request body must be JSON.", 400);
  }

  const parsed = QuizDraftInputSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("invalid_request", "Quiz draft request is invalid.", 400);
  }

  try {
    const service = createAdminQuizService(
      createQuizRepository(createDb()),
      mockAIProvider,
    );
    const response = await service.generateDrafts(parsed.data);

    return NextResponse.json<AdminQuizDraftGenerationResponse>(response);
  } catch (error) {
    if (error instanceof AdminQuizServiceError) {
      return apiError(error.code, error.message, 502);
    }

    return apiError("server_error", "Quiz draft generation is unavailable.", 500);
  }
}

function getAdminAccess(request: Request) {
  try {
    requireAdminSecret(request);
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return apiError(
        error.code,
        error.message,
        error.code === "unauthorized" ? 401 : 500,
      );
    }

    return apiError("server_error", "Admin authentication is unavailable.", 500);
  }
}
