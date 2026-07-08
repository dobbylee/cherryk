import { NextResponse } from "next/server";
import type { MeResponse } from "@/lib/contracts/auth";
import { createDb } from "@/server/db";
import { createAuthRepository } from "@/server/repositories/authRepository";
import { createAuthService } from "@/server/services/authService";
import { apiError } from "../_responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const service = createAuthService(createAuthRepository(createDb()));
    const user = await service.getCurrentUser(request);

    return NextResponse.json<MeResponse>({ user });
  } catch {
    return apiError("server_error", "Current user is unavailable.", 500);
  }
}
