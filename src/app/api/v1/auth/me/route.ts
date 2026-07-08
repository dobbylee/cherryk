import { NextResponse } from "next/server";
import type { MeResponse } from "@/lib/contracts/auth";
import { getCurrentUser } from "@/server/auth/currentUser";
import { apiError } from "../_responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);

    return NextResponse.json<MeResponse>({ user });
  } catch {
    return apiError("server_error", "Current user is unavailable.", 500);
  }
}
