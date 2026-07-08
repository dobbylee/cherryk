import { createDb } from "@/server/db";
import { createAuthRepository } from "@/server/repositories/authRepository";
import { createAuthService } from "@/server/services/authService";

export function createRequestAuthService() {
  return createAuthService(createAuthRepository(createDb()));
}

export async function getCurrentUser(request: Request) {
  return createRequestAuthService().getCurrentUser(request);
}

export async function requireCurrentUser(request: Request) {
  return createRequestAuthService().requireCurrentUser(request);
}
