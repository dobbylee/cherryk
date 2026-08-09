import { MeResponseSchema } from "@/lib/contracts/auth";
import { fetchJson, fetchNoContent } from "./client";

export function fetchCurrentUser() {
  return fetchJson("/api/v1/auth/me", MeResponseSchema);
}

export function login() {
  window.location.assign(loginPathForHostname(window.location.hostname));
}

export async function logout() {
  await fetchNoContent("/api/auth/logout", { method: "POST" });
}

export function loginPathForHostname(hostname: string) {
  return hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
    ? "/api/auth/login/local"
    : "/api/auth/login/google";
}
