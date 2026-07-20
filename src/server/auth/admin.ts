import { auth } from "@/server/auth/auth";

type AdminSession = {
  user: {
    email: string;
    emailVerified: boolean;
  };
};

type SessionResolver = (headers: Headers) => Promise<AdminSession | null>;

export class AdminAuthError extends Error {
  constructor(
    readonly code: "admin_not_configured" | "unauthorized" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function requireAdminAccount(
  request: Request,
  adminEmails = process.env.ADMIN_EMAILS,
  resolveSession: SessionResolver = getAuthSession,
) {
  const allowedEmails = parseAdminEmails(adminEmails);
  const session = await resolveSession(request.headers);

  if (!session) {
    throw new AdminAuthError("unauthorized", "Authentication required.");
  }

  const email = normalizeEmail(session.user.email);
  if (!session.user.emailVerified || !allowedEmails.has(email)) {
    throw new AdminAuthError("forbidden", "Admin access is not allowed.");
  }
}

function parseAdminEmails(value: string | undefined) {
  const emails = new Set(value?.split(",").map(normalizeEmail).filter(Boolean));

  if (!emails.size) {
    throw new AdminAuthError(
      "admin_not_configured",
      "Admin access is not configured.",
    );
  }

  return emails;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

async function getAuthSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
