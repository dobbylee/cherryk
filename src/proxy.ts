import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

const WRITE_FROZEN_MODE = "write-frozen";
const BYPASS_HEADER = "x-cherryk-maintenance-bypass";
const BYPASS_COOKIE = "CHERRYK_MAINTENANCE_BYPASS";
const BYPASS_PATH = "/api/maintenance/bypass";
const MINIMUM_BYPASS_TOKEN_LENGTH = 32;
const BYPASS_COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;

type MaintenanceEnvironment = {
  mode: string | undefined;
  bypassToken: string | undefined;
};

export function createMaintenanceProxy(environment: MaintenanceEnvironment) {
  return function maintenanceProxy(request: NextRequest) {
    if (environment.mode !== WRITE_FROZEN_MODE) {
      return NextResponse.next();
    }

    if (request.nextUrl.pathname === BYPASS_PATH) {
      return handleBypassRequest(request, environment.bypassToken);
    }

    if (
      !isProtectedApiPath(request.nextUrl.pathname) ||
      hasOperatorBypass(request, environment.bypassToken)
    ) {
      return NextResponse.next();
    }

    return maintenanceResponse();
  };
}

export const proxy = createMaintenanceProxy({
  mode: process.env.CHERRYK_MAINTENANCE_MODE,
  bypassToken: process.env.CHERRYK_MAINTENANCE_BYPASS_TOKEN,
});

export const config = {
  matcher: ["/api/:path*"],
};

function isProtectedApiPath(pathname: string) {
  return isAtOrBelow(pathname, "/api/auth") || isAtOrBelow(pathname, "/api/v1");
}

function isAtOrBelow(pathname: string, basePath: string) {
  return pathname === basePath || pathname.startsWith(`${basePath}/`);
}

function handleBypassRequest(
  request: NextRequest,
  configuredToken: string | undefined,
) {
  if (request.method === "DELETE") {
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(BYPASS_COOKIE, "", {
      httpOnly: true,
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
    return noStore(response);
  }

  if (request.method !== "POST") {
    return apiError("method_not_allowed", "Method is not allowed.", 405);
  }

  if (
    !matchesConfiguredToken(request.headers.get(BYPASS_HEADER), configuredToken)
  ) {
    return apiError("forbidden", "Access is not allowed.", 403);
  }

  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(
    BYPASS_COOKIE,
    digestToken(requireValidConfiguredToken(configuredToken)),
    {
      httpOnly: true,
      maxAge: BYPASS_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: true,
    },
  );
  return noStore(response);
}

function hasOperatorBypass(
  request: NextRequest,
  configuredToken: string | undefined,
) {
  if (!isValidConfiguredToken(configuredToken)) {
    return false;
  }

  if (
    matchesConfiguredToken(request.headers.get(BYPASS_HEADER), configuredToken)
  ) {
    return true;
  }

  return timingSafeMatches(
    request.cookies.get(BYPASS_COOKIE)?.value,
    digestToken(configuredToken),
  );
}

function matchesConfiguredToken(
  candidate: string | null,
  configuredToken: string | undefined,
) {
  return (
    isValidConfiguredToken(configuredToken) &&
    timingSafeMatches(candidate, configuredToken)
  );
}

function timingSafeMatches(
  candidate: string | null | undefined,
  expected: string,
) {
  if (!candidate) {
    return false;
  }

  const candidateDigest = createHash("sha256").update(candidate).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(candidateDigest, expectedDigest);
}

function digestToken(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function isValidConfiguredToken(token: string | undefined): token is string {
  return token !== undefined && token.length >= MINIMUM_BYPASS_TOKEN_LENGTH;
}

function requireValidConfiguredToken(token: string | undefined) {
  if (!isValidConfiguredToken(token)) {
    throw new Error("A valid maintenance bypass token is required.");
  }
  return token;
}

function maintenanceResponse() {
  const response = apiError(
    "maintenance",
    "CherryK is temporarily read-only.",
    503,
  );
  response.headers.set("Retry-After", "300");
  return response;
}

function apiError(code: string, message: string, status: number) {
  return noStore(
    NextResponse.json(
      {
        error: {
          code,
          message,
        },
      },
      { status },
    ),
  );
}

function noStore(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store");
  return response;
}
