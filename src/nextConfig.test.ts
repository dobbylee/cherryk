import { describe, expect, it } from "vitest";
import { createNextConfig } from "../next.config";

describe("Next Preview backend routing", () => {
  it("keeps the existing Next backend when no Spring origin is configured", async () => {
    const config = createNextConfig(undefined);

    expect(config.env?.NEXT_PUBLIC_SPRING_BACKEND_ENABLED).toBe("false");
    await expect(config.rewrites?.()).resolves.toEqual([]);
  });

  it("rewrites API and auth paths only when a valid Spring origin is configured", async () => {
    const config = createNextConfig("https://api-preview.cherryk.kr/");

    expect(config.env?.NEXT_PUBLIC_SPRING_BACKEND_ENABLED).toBe("true");
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
    expect(() =>
      createNextConfig("http://api-preview.cherryk.kr"),
    ).toThrow(/HTTPS origin/);
    expect(() =>
      createNextConfig("https://api-preview.cherryk.kr/api"),
    ).toThrow(/HTTPS origin/);
    expect(() =>
      createNextConfig("https://user:secret@api-preview.cherryk.kr"),
    ).toThrow(/HTTPS origin/);
  });
});
