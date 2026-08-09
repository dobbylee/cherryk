import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchNoContent: vi.fn(),
  locationAssign: vi.fn(),
}));

vi.mock("./client", () => ({
  fetchJson: vi.fn(),
  fetchNoContent: mocks.fetchNoContent,
}));

import { login, loginPathForHostname, logout } from "./auth";

describe("auth API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts local login on localhost", () => {
    vi.stubGlobal("window", {
      location: { assign: mocks.locationAssign, hostname: "localhost" },
    });

    login();

    expect(mocks.locationAssign).toHaveBeenCalledWith("/api/auth/login/local");
  });

  it("starts Google login outside local development", () => {
    vi.stubGlobal("window", {
      location: { assign: mocks.locationAssign, hostname: "cherryk.kr" },
    });

    login();

    expect(mocks.locationAssign).toHaveBeenCalledWith("/api/auth/login/google");
  });

  it("limits local login routing to loopback hostnames", () => {
    expect(loginPathForHostname("127.0.0.1")).toBe("/api/auth/login/local");
    expect(loginPathForHostname("[::1]")).toBe("/api/auth/login/local");
    expect(loginPathForHostname("localhost.attacker.test")).toBe(
      "/api/auth/login/google",
    );
  });

  it("logs out through Spring", async () => {
    mocks.fetchNoContent.mockResolvedValue(undefined);

    await logout();

    expect(mocks.fetchNoContent).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});
