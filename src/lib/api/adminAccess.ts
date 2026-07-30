import { normalizeSpringBackendOrigin } from "@/lib/springBackendOrigin";

type SpringAdminAccess = "allowed" | "unauthorized" | "forbidden";
type SpringAdminAccessResolver = (
  origin: string,
  headers: Headers,
) => Promise<SpringAdminAccess>;

export class AdminAuthError extends Error {
  constructor(
    readonly code: "unauthorized" | "forbidden",
    message: string,
  ) {
    super(message);
    this.name = "AdminAuthError";
  }
}

export async function requireAdminAccount(
  request: Request,
  springBackendOrigin = process.env.SPRING_BACKEND_ORIGIN,
  resolveSpringAccess: SpringAdminAccessResolver = getSpringAdminAccess,
) {
  const origin = normalizeSpringBackendOrigin(springBackendOrigin);
  if (!origin) {
    throw new Error(
      "SPRING_BACKEND_ORIGIN is required for admin authorization.",
    );
  }

  const access = await resolveSpringAccess(origin, request.headers);
  if (access === "allowed") {
    return;
  }
  if (access === "unauthorized") {
    throw new AdminAuthError("unauthorized", "Authentication required.");
  }
  throw new AdminAuthError("forbidden", "Admin access is not allowed.");
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
