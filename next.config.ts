import type { NextConfig } from "next";
import { normalizeSpringBackendOrigin } from "./src/lib/springBackendOrigin";

export function createNextConfig(
  configuredSpringBackendOrigin: string | undefined,
): NextConfig {
  const springBackendOrigin = normalizeSpringBackendOrigin(
    configuredSpringBackendOrigin,
  );
  if (!springBackendOrigin) {
    throw new Error(
      "SPRING_BACKEND_ORIGIN is required because CherryK uses Spring for all API and authentication routes.",
    );
  }

  return {
    typedRoutes: true,
    async rewrites() {
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

const nextConfig = () => createNextConfig(process.env.SPRING_BACKEND_ORIGIN);

export default nextConfig;
