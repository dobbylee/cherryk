import { authClient } from "@/lib/auth-client";
import type { MeResponse } from "@/lib/contracts/auth";
import { fetchJson, fetchNoContent } from "./client";

export function fetchCurrentUser() {
  return fetchJson<MeResponse>("/api/v1/auth/me");
}

export async function loginWithGoogle() {
  if (usesSpringBackend()) {
    window.location.assign("/api/auth/login/google");
    return;
  }

  const { error } = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/",
  });

  if (error) {
    throw new Error(error.message ?? "Google sign-in failed.");
  }
}

export async function logout() {
  if (usesSpringBackend()) {
    await fetchNoContent("/api/auth/logout", { method: "POST" });
    return;
  }

  const { error } = await authClient.signOut();
  if (error) {
    throw new Error(error.message ?? "Logout failed.");
  }
}

function usesSpringBackend() {
  return process.env.NEXT_PUBLIC_SPRING_BACKEND_ENABLED === "true";
}
