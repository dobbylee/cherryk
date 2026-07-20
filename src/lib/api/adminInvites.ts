import { ADMIN_SECRET_HEADER } from "@/lib/contracts/admin";
import type {
  AdminInviteCreateRequest,
  AdminInviteCreateResponse,
  AdminInviteUsersResponse,
} from "@/lib/contracts/invite";
import { fetchJson } from "./client";

export function fetchAdminInviteUsers(adminSecret: string) {
  return fetchJson<AdminInviteUsersResponse>("/api/v1/admin/invites", {
    headers: {
      [ADMIN_SECRET_HEADER]: adminSecret,
    },
  });
}

export function createAdminInvite(
  adminSecret: string,
  input: AdminInviteCreateRequest,
) {
  return fetchJson<AdminInviteCreateResponse>("/api/v1/admin/invites", {
    method: "POST",
    headers: {
      [ADMIN_SECRET_HEADER]: adminSecret,
    },
    body: JSON.stringify(input),
  });
}
