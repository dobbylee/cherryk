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
    readonly code: "invalid_invite",
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

export type AuthService = {
  loginWithInvite(input: InviteLoginRequest): Promise<LoginWithInviteResult>;
  getCurrentUser(request: Request): Promise<AuthUser | null>;
  logout(request: Request): Promise<void>;
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

  return {
    async loginWithInvite(input) {
      const currentTime = now();
      const authSecret = requireAuthSecret(options.authSecret);
      const sessionToken = createToken();
      const sessionExpiresAt = createSessionExpiresAt(currentTime);
      const user = await repository.createInviteSession({
        inviteCodeHash: hashInviteCode(input.inviteCode, authSecret),
        displayName: input.displayName ?? null,
        sessionTokenHash: hashSessionToken(sessionToken, authSecret),
        sessionExpiresAt,
        now: currentTime,
      });

      if (!user) {
        throw new AuthServiceError(
          "invalid_invite",
          "Invite code is invalid, expired, or already used.",
        );
      }

      return {
        user,
        sessionToken,
        sessionExpiresAt,
      };
    },

    async getCurrentUser(request) {
      const sessionToken = readSessionTokenFromRequest(request);
      if (!sessionToken) {
        return null;
      }

      return repository.findUserBySessionTokenHash(
        hashSessionToken(sessionToken, requireAuthSecret(options.authSecret)),
        now(),
      );
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
  };
}
