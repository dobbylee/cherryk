import { NextResponse } from "next/server";
import {
  InviteLoginRequestSchema,
  type InviteLoginResponse,
} from "@/lib/contracts/auth";
import { createDb } from "@/server/db";
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from "@/server/auth/session";
import { createAuthRepository } from "@/server/repositories/authRepository";
import {
  AuthServiceError,
  createAuthService,
} from "@/server/services/authService";
import { apiError } from "../_responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return apiError("invalid_request", "Request body must be JSON.", 400);
  }

  const parsed = InviteLoginRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("invalid_request", "Invite login request is invalid.", 400);
  }

  try {
    const service = createAuthService(createAuthRepository(createDb()));
    const result = await service.loginWithInvite(parsed.data);
    const response = NextResponse.json<InviteLoginResponse>({
      user: result.user,
    });

    response.cookies.set(
      SESSION_COOKIE_NAME,
      result.sessionToken,
      sessionCookieOptions(result.sessionExpiresAt),
    );

    return response;
  } catch (error) {
    if (error instanceof AuthServiceError) {
      return apiError(error.code, error.message, 401);
    }

    return apiError("server_error", "Authentication is unavailable.", 500);
  }
}
