import type {
  AdminInviteCreateRequest,
  AdminInviteCreateResponse,
  AdminInviteUsersResponse,
} from "@/lib/contracts/invite";
import { createInviteCode, hashInviteCode } from "@/server/auth/session";
import type { InviteRepository } from "@/server/repositories/inviteRepository";

export class AdminInviteServiceError extends Error {
  constructor(
    readonly code: "user_not_found",
    message: string,
  ) {
    super(message);
    this.name = "AdminInviteServiceError";
  }
}

type AdminInviteServiceOptions = {
  authSecret?: string;
  createCode?: () => string;
};

export function createAdminInviteService(
  repository: InviteRepository,
  options: AdminInviteServiceOptions = {},
) {
  const generateCode = options.createCode ?? createInviteCode;

  return {
    async createInviteLink(
      input: AdminInviteCreateRequest,
      origin: string,
    ): Promise<AdminInviteCreateResponse> {
      if (input.userId && !(await repository.findUserById(input.userId))) {
        throw new AdminInviteServiceError(
          "user_not_found",
          "The recovery user does not exist.",
        );
      }

      const inviteCode = generateCode();
      await repository.createOneTimeInvite({
        codeHash: hashInviteCode(inviteCode, options.authSecret),
        label: input.label,
        userId: input.userId ?? null,
      });

      const kind = input.userId ? "recovery" : "invite";
      const link = new URL("/join", origin);
      link.searchParams.set(kind, inviteCode);

      return {
        kind,
        link: link.toString(),
      };
    },

    async listUsers(): Promise<AdminInviteUsersResponse> {
      return { users: await repository.listUsers() };
    },
  };
}
