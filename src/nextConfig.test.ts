import { describe, expect, it } from "vitest";
import { createNextConfig } from "../next.config";

describe("Next Spring backend routing", () => {
  it("fails closed when no Spring origin is configured", () => {
    expect(() => createNextConfig(undefined)).toThrow(
      "SPRING_BACKEND_ORIGIN is required",
    );
  });

  it("rewrites API and auth paths when a valid Spring origin is configured", async () => {
    const config = createNextConfig("https://api-preview.cherryk.kr/");

    await expect(config.rewrites?.()).resolves.toEqual({
      beforeFiles: [
        {
          source: "/api/v1/:path*",
          destination: "https://api-preview.cherryk.kr/api/v1/:path*",
        },
        {
          source: "/api/auth/:path*",
          destination: "https://api-preview.cherryk.kr/api/auth/:path*",
        },
      ],
      afterFiles: [],
      fallback: [],
    });
  });

  it("rejects unsafe or path-bearing backend origins", () => {
    expect(() => createNextConfig("http://api-preview.cherryk.kr")).toThrow(
      /HTTPS origin/,
    );
    expect(() =>
      createNextConfig("https://api-preview.cherryk.kr/api"),
    ).toThrow(/HTTPS origin/);
    expect(() =>
      createNextConfig("https://user:secret@api-preview.cherryk.kr"),
    ).toThrow(/HTTPS origin/);
  });
});
