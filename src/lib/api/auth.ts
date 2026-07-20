import { authClient } from "@/lib/auth-client";
import type { MeResponse } from "@/lib/contracts/auth";
import { fetchJson } from "./client";

export function fetchCurrentUser() {
  return fetchJson<MeResponse>("/api/v1/auth/me");
}

export async function loginWithGoogle() {
  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
  });

  if (error) {
    throw new Error(error.message ?? "Google sign-in failed.");
  }
}

export async function logout() {
  const { error } = await authClient.signOut();
  if (error) {
    throw new Error(error.message ?? "Logout failed.");
  }
}
