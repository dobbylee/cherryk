import { MeResponseSchema } from "@/lib/contracts/auth";
import { fetchJson, fetchNoContent } from "./client";

export function fetchCurrentUser() {
  return fetchJson("/api/v1/auth/me", MeResponseSchema);
}

export function loginWithGoogle() {
  window.location.assign("/api/auth/login/google");
}

export async function logout() {
  await fetchNoContent("/api/auth/logout", { method: "POST" });
}
