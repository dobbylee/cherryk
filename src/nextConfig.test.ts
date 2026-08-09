import { describe, expect, it } from "vitest";
import { createNextConfig } from "../next.config";

describe("Next Spring backend routing", () => {
  it("fails closed when no Spring origin is configured", () => {
    expect(() => createNextConfig(undefined)).toThrow(
      "SPRING_BACKEND_ORIGIN is required",
    );
  });

  it("rewrites API and auth paths when a valid Spring origin is configured", async () => {
    const config = createNextConfig("https://api.example.test/");

    await expect(config.rewrites?.()).resolves.toEqual({
      beforeFiles: [
        {
          source: "/api/v1/:path*",
          destination: "https://api.example.test/api/v1/:path*",
        },
        {
          source: "/api/auth/:path*",
          destination: "https://api.example.test/api/auth/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    });
  });

  it("rejects unsafe or path-bearing backend origins", () => {
    expect(() => createNextConfig("http://api.example.test")).toThrow(
      /HTTPS origin/,
    );
    expect(() => createNextConfig("https://api.example.test/api")).toThrow(
      /HTTPS origin/,
    );
    expect(() =>
      createNextConfig("https://user:secret@api.example.test"),
    ).toThrow(/HTTPS origin/);
  });
});
