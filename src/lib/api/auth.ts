import type { MeResponse } from "@/lib/contracts/auth";
import { fetchJson, fetchNoContent } from "./client";

export function fetchCurrentUser() {
  return fetchJson<MeResponse>("/api/v1/auth/me");
}

export function loginWithGoogle() {
  window.location.assign("/api/auth/login/google");
}

export async function logout() {
  await fetchNoContent("/api/auth/logout", { method: "POST" });
}
