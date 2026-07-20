import type { AuthUser, InviteLoginRequest } from "@/lib/contracts/auth";
import {
  createSessionExpiresAt,
  createSessionToken,
  hashInviteCode,
  hashSessionToken,
  readSessionTokenFromRequest,
  requireAuthSecret,
} from "@/server/auth/session";
import type { AuthRepository } from "@/server/repositories/authRepository";

export class AuthServiceError extends Error {
  constructor(
    readonly code:
      | "display_name_required"
      | "invalid_invite"
      | "invalid_invite_seed"
      | "unauthorized",
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export type LoginWithInviteResult = {
  user: AuthUser;
  sessionToken: string;
  sessionExpiresAt: Date;
};

export type SeedInviteCodeRequest = {
  inviteCode: string;
  label?: string | null;
  expiresAt?: Date | null;
};

export type AuthService = {
  loginWithInvite(input: InviteLoginRequest): Promise<LoginWithInviteResult>;
  getCurrentUser(request: Request): Promise<AuthUser | null>;
  requireCurrentUser(request: Request): Promise<AuthUser>;
  logout(request: Request): Promise<void>;
  seedInviteCode(input: SeedInviteCodeRequest): Promise<void>;
};

type AuthServiceOptions = {
  authSecret?: string;
  now?: () => Date;
  createToken?: () => string;
};

export function createAuthService(
  repository: AuthRepository,
  options: AuthServiceOptions = {},
): AuthService {
  const now = options.now ?? (() => new Date());
  const createToken = options.createToken ?? createSessionToken;

  async function getCurrentUser(request: Request) {
    const sessionToken = readSessionTokenFromRequest(request);
    if (!sessionToken) {
      return null;
    }

    return repository.findUserBySessionTokenHash(
      hashSessionToken(sessionToken, requireAuthSecret(options.authSecret)),
      now(),
    );
  }

  return {
    async loginWithInvite(input) {
      const currentTime = now();
      const authSecret = requireAuthSecret(options.authSecret);
      const sessionToken = createToken();
      const sessionExpiresAt = createSessionExpiresAt(currentTime);
      const loginResult = await repository.createInviteSession({
        inviteCodeHash: hashInviteCode(input.inviteCode, authSecret),
        displayName: input.displayName ?? null,
        sessionTokenHash: hashSessionToken(sessionToken, authSecret),
        sessionExpiresAt,
        now: currentTime,
      });

      if (loginResult.status === "display_name_required") {
        throw new AuthServiceError(
          "display_name_required",
          "Display name is required for a new invite.",
        );
      }

      if (loginResult.status === "invalid") {
        throw new AuthServiceError(
          "invalid_invite",
          "Invite code is invalid, expired, or already used.",
        );
      }

      return {
        user: loginResult.user,
        sessionToken,
        sessionExpiresAt,
      };
    },

    getCurrentUser,

    async requireCurrentUser(request) {
      const user = await getCurrentUser(request);
      if (!user) {
        throw new AuthServiceError("unauthorized", "Authentication required.");
      }

      return user;
    },

    async logout(request) {
      const sessionToken = readSessionTokenFromRequest(request);
      if (!sessionToken) {
        return;
      }

      await repository.deleteSessionByTokenHash(
        hashSessionToken(sessionToken, requireAuthSecret(options.authSecret)),
      );
    },

    async seedInviteCode(input) {
      const inviteCode = input.inviteCode.trim();
      if (!inviteCode) {
        throw new AuthServiceError(
          "invalid_invite_seed",
          "Invite seed must include a code.",
        );
      }

      await repository.upsertInviteCode({
        codeHash: hashInviteCode(
          inviteCode,
          requireAuthSecret(options.authSecret),
        ),
        label: input.label ?? null,
        maxUses: 1,
        expiresAt: input.expiresAt ?? null,
      });
    },
  };
}
