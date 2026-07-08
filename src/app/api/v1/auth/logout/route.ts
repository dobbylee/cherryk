import { NextResponse } from "next/server";
import type { LogoutResponse } from "@/lib/contracts/auth";
import { createRequestAuthService } from "@/server/auth/currentUser";
import {
  SESSION_COOKIE_NAME,
  expiredSessionCookieOptions,
} from "@/server/auth/session";
import { apiError } from "../../_responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await createRequestAuthService().logout(request);

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
