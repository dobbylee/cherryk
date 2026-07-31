import type { AuthUser, MeResponse } from "@/lib/contracts/auth";

export type ResolvedAuthSession =
  | { status: "authenticated"; user: AuthUser }
  | { status: "signed-out"; user: null }
  | { status: "unavailable"; user: null; message: string };

export async function resolveAuthSession(
  fetchCurrentUser: () => Promise<MeResponse>,
): Promise<ResolvedAuthSession> {
  try {
    const response = await fetchCurrentUser();
    return response.user
      ? { status: "authenticated", user: response.user }
      : { status: "signed-out", user: null };
  } catch {
    return {
      status: "unavailable",
      user: null,
      message: "Authentication is unavailable.",
    };
  }
}
