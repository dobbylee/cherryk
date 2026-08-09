import { describe, expect, it } from "vitest";
import vercelConfig from "../vercel.json";

describe("Vercel Git deployment policy", () => {
  it("automatically deploys only the Production branch", () => {
    expect(vercelConfig.git.deploymentEnabled).toEqual({
      main: true,
      "*": false,
    });
  });
});
