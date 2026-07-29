import type { NextConfig } from "next";
import { normalizeSpringBackendOrigin } from "./src/lib/springBackendOrigin";

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

const nextConfig = createNextConfig(process.env.SPRING_BACKEND_ORIGIN);

export default nextConfig;
