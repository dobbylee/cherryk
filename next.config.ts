import type { NextConfig } from "next";

export function createNextConfig(
  configuredSpringBackendOrigin: string | undefined,
): NextConfig {
  const springBackendOrigin = normalizeSpringBackendOrigin(
    configuredSpringBackendOrigin,
  );

  return {
    typedRoutes: true,
    env: {
      NEXT_PUBLIC_SPRING_BACKEND_ENABLED: springBackendOrigin
        ? "true"
        : "false",
    },
    async rewrites() {
      if (!springBackendOrigin) {
        return [];
      }

      return {
        beforeFiles: [
          {
            source: "/api/v1/:path*",
            destination: `${springBackendOrigin}/api/v1/:path*`,
          },
          {
            source: "/api/auth/:path*",
            destination: `${springBackendOrigin}/api/auth/:path*`,
          },
        ],
        afterFiles: [],
        fallback: [],
      };
    },
  };
}

function normalizeSpringBackendOrigin(value: string | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const url = new URL(value);
  const isLocalHttp =
    url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (
    (url.protocol !== "https:" && !isLocalHttp) ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      "SPRING_BACKEND_ORIGIN must be an HTTPS origin without credentials, path, query, or fragment.",
    );
  }

  return url.origin;
}

const nextConfig = createNextConfig(process.env.SPRING_BACKEND_ORIGIN);

export default nextConfig;
