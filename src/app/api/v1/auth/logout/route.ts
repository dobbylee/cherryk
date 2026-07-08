import { NextResponse } from "next/server";
import type { LogoutResponse } from "@/lib/contracts/auth";
import { createDb } from "@/server/db";
import {
  SESSION_COOKIE_NAME,
  expiredSessionCookieOptions,
} from "@/server/auth/session";
import { createAuthRepository } from "@/server/repositories/authRepository";
import { createAuthService } from "@/server/services/authService";
import { apiError } from "../_responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const service = createAuthService(createAuthRepository(createDb()));
    await service.logout(request);

    const response = NextResponse.json<LogoutResponse>({ ok: true });
    response.cookies.set(
      SESSION_COOKIE_NAME,
      "",
      expiredSessionCookieOptions(),
    );

    return response;
  } catch {
    return apiError("server_error", "Logout is unavailable.", 500);
  }
}
