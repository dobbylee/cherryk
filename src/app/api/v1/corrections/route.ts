import { NextResponse } from "next/server";
import {
  CorrectionInputSchema,
  type CorrectionResponse,
} from "@/lib/contracts/correction";
import { mockAIProvider } from "@/server/ai/mockAIProvider";
import { requireCurrentUser } from "@/server/auth/currentUser";
import { createDb } from "@/server/db";
import { createCorrectionRepository } from "@/server/repositories/correctionRepository";
import {
  CorrectionServiceError,
  createCorrectionService,
} from "@/server/services/correctionService";
import { AuthServiceError } from "@/server/services/authService";
import { apiError } from "../_responses";

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

  const parsed = CorrectionInputSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("invalid_request", "Correction request is invalid.", 400);
  }

  try {
    const service = createCorrectionService(
      createCorrectionRepository(createDb()),
      mockAIProvider,
    );
    const response = await service.correctKorean(userResult, parsed.data);

    return NextResponse.json<CorrectionResponse>(response);
  } catch (error) {
    if (error instanceof CorrectionServiceError) {
      return apiError(error.code, error.message, 502);
    }

    return apiError("server_error", "Correction is unavailable.", 500);
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
