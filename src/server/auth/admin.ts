import { auth } from "@/server/auth/auth";
import { normalizeSpringBackendOrigin } from "@/lib/springBackendOrigin";

type AdminSession = {
  user: {
    email: string;
    emailVerified: boolean;
  };
};

type SessionResolver = (headers: Headers) => Promise<AdminSession | null>;
type SpringAdminAccess = "allowed" | "unauthorized" | "forbidden";
type SpringAdminAccessResolver = (
  origin: string,
  headers: Headers,
) => Promise<SpringAdminAccess>;

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
  springBackendOrigin = process.env.SPRING_BACKEND_ORIGIN,
  resolveSpringAccess: SpringAdminAccessResolver = getSpringAdminAccess,
) {
  const normalizedSpringBackendOrigin =
    normalizeSpringBackendOrigin(springBackendOrigin);
  if (normalizedSpringBackendOrigin) {
    const access = await resolveSpringAccess(
      normalizedSpringBackendOrigin,
      request.headers,
    );
    if (access === "allowed") {
      return;
    }
    if (access === "unauthorized") {
      throw new AdminAuthError("unauthorized", "Authentication required.");
    }
    throw new AdminAuthError("forbidden", "Admin access is not allowed.");
  }

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

async function getSpringAdminAccess(
  origin: string,
  requestHeaders: Headers,
): Promise<SpringAdminAccess> {
  const sessionCookie = findCookie(requestHeaders, "CHERRYK_SESSION");
  const response = await fetch(new URL("/api/v1/admin/access", origin), {
    cache: "no-store",
    headers: sessionCookie ? { cookie: sessionCookie } : undefined,
    redirect: "manual",
  });

  if (response.status === 204) {
    return "allowed";
  }
  if (response.status === 401) {
    return "unauthorized";
  }
  if (response.status === 403) {
    return "forbidden";
  }
  throw new Error(
    `Spring admin access check failed with status ${response.status}.`,
  );
}

function findCookie(headers: Headers, name: string) {
  const prefix = `${name}=`;
  return headers
    .get("cookie")
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(prefix));
}
