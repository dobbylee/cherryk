import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchNoContent: vi.fn(),
  locationAssign: vi.fn(),
}));

vi.mock("./client", () => ({
  fetchJson: vi.fn(),
  fetchNoContent: mocks.fetchNoContent,
}));

import { loginWithGoogle, logout } from "./auth";

describe("auth API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("starts Google login through Spring", () => {
    vi.stubGlobal("window", {
      location: { assign: mocks.locationAssign },
    });

    loginWithGoogle();

    expect(mocks.locationAssign).toHaveBeenCalledWith("/api/auth/login/google");
  });

  it("logs out through Spring", async () => {
    mocks.fetchNoContent.mockResolvedValue(undefined);

    await logout();

    expect(mocks.fetchNoContent).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
  });
});
