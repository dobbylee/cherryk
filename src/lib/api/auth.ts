import type {
  InviteLoginResponse,
  LogoutResponse,
  MeResponse,
} from "@/lib/contracts/auth";
import { fetchJson } from "./client";

export function fetchCurrentUser() {
  return fetchJson<MeResponse>("/api/v1/auth/me");
}

export function loginWithInvite(input: {
  inviteCode: string;
  displayName?: string;
}) {
  return fetchJson<InviteLoginResponse>("/api/v1/auth/invite", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function logout() {
  return fetchJson<LogoutResponse>("/api/v1/auth/logout", {
    method: "POST",
  });
}
