import { NextResponse } from "next/server";
import {
  AdminInviteCreateRequestSchema,
  type AdminInviteCreateResponse,
  type AdminInviteUsersResponse,
} from "@/lib/contracts/invite";
import { AdminAuthError, requireAdminSecret } from "@/server/auth/admin";
import { createDb } from "@/server/db";
import { createInviteRepository } from "@/server/repositories/inviteRepository";
import {
  AdminInviteServiceError,
  createAdminInviteService,
} from "@/server/services/adminInviteService";
import { apiError } from "../../_responses";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const adminResult = getAdminAccess(request);
  if (adminResult instanceof Response) {
    return adminResult;
  }

  try {
    const service = createAdminInviteService(
      createInviteRepository(createDb()),
    );
    return NextResponse.json<AdminInviteUsersResponse>(
      await service.listUsers(),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return apiError("server_error", "Invite users are unavailable.", 500);
  }
}

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

  const parsed = AdminInviteCreateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return apiError("invalid_request", "Invite request is invalid.", 400);
  }

  try {
    const service = createAdminInviteService(
      createInviteRepository(createDb()),
    );
    const response = await service.createInviteLink(
      parsed.data,
      new URL(request.url).origin,
    );
    return NextResponse.json<AdminInviteCreateResponse>(response, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof AdminInviteServiceError) {
      return apiError(error.code, error.message, 404);
    }

    return apiError("server_error", "Invite creation is unavailable.", 500);
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

    return apiError(
      "server_error",
      "Admin authentication is unavailable.",
      500,
    );
  }
}
