import { AuthUserSchema } from "@/lib/contracts/auth";
import { auth } from "@/server/auth/auth";

export class AuthenticationError extends Error {
  readonly code = "unauthorized";

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export async function getCurrentUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return null;
  }

  return AuthUserSchema.parse({
    id: session.user.id,
    displayName: session.user.name,
    level: session.user.level,
  });
}

export async function requireCurrentUser(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) {
    throw new AuthenticationError();
  }

  return user;
}
