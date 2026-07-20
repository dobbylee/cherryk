import { NextResponse } from "next/server";
import {
  QuizRecommendationQuerySchema,
  type QuizRecommendationResponse,
} from "@/lib/contracts/quiz";
import {
  AuthenticationError,
  requireCurrentUser,
} from "@/server/auth/currentUser";
import { createDb } from "@/server/db";
import { createQuizRepository } from "@/server/repositories/quizRepository";
import { createQuizRecommendationService } from "@/server/services/quizRecommendationService";
import { apiError } from "../../_responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const userResult = await getAuthenticatedUser(request);
  if (userResult instanceof Response) {
    return userResult;
  }

  const searchParams = new URL(request.url).searchParams;
  const parsed = QuizRecommendationQuerySchema.safeParse({
    tags: searchParams.has("tags")
      ? parseTags(searchParams.get("tags"))
      : undefined,
  });
  if (!parsed.success) {
    return apiError("invalid_request", "Quiz recommendation query is invalid.", 400);
  }

  try {
    const service = createQuizRecommendationService(
      createQuizRepository(createDb()),
    );
    const response = await service.recommendByTags(
      userResult,
      searchParams.has("tags") ? parsed.data.tags : null,
    );

    return NextResponse.json<QuizRecommendationResponse>(response);
  } catch {
    return apiError("server_error", "Quiz recommendations are unavailable.", 500);
  }
}

function parseTags(value: string | null) {
  return (
    value
      ?.split(",")
      .map((tag) => tag.trim())
      .filter(Boolean) ?? []
  );
}

async function getAuthenticatedUser(request: Request) {
  try {
    return await requireCurrentUser(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.code, error.message, 401);
    }

    return apiError("server_error", "Authentication is unavailable.", 500);
  }
}
