import { NextResponse } from "next/server";
import { z } from "zod";
import {
  type AdminQuizDeleteResponse,
  AdminQuizUpdateRequestSchema,
  type AdminQuizUpdateResponse,
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const adminResult = getAdminAccess(request);
  if (adminResult instanceof Response) {
    return adminResult;
  }

  const { id } = await context.params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    return apiError("invalid_request", "Quiz id is invalid.", 400);
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return apiError("invalid_request", "Request body must be JSON.", 400);
  }

  const parsed = AdminQuizUpdateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("invalid_request", "Quiz update request is invalid.", 400);
  }

  try {
    const service = createAdminQuizService(
      createQuizRepository(createDb()),
      mockAIProvider,
    );
    const response = await service.updateQuiz(parsedId.data, parsed.data);

    return NextResponse.json<AdminQuizUpdateResponse>(response);
  } catch (error) {
    if (error instanceof AdminQuizServiceError) {
      return apiError(
        error.code,
        error.message,
        error.code === "quiz_not_found"
          ? 404
          : error.code === "quiz_choices_locked"
            ? 409
            : 502,
      );
    }

    return apiError("server_error", "Quiz update is unavailable.", 500);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const adminResult = getAdminAccess(request);
  if (adminResult instanceof Response) {
    return adminResult;
  }

  const { id } = await context.params;
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) {
    return apiError("invalid_request", "Quiz id is invalid.", 400);
  }

  try {
    const service = createAdminQuizService(
      createQuizRepository(createDb()),
      mockAIProvider,
    );
    const response = await service.deleteDraft(parsedId.data);

    return NextResponse.json<AdminQuizDeleteResponse>(response);
  } catch (error) {
    if (error instanceof AdminQuizServiceError) {
      return apiError(
        error.code,
        error.message,
        error.code === "quiz_not_found" ? 404 : 500,
      );
    }

    return apiError("server_error", "Quiz deletion is unavailable.", 500);
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
