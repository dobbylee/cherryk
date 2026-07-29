import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInSocial: vi.fn(),
  signOut: vi.fn(),
  fetchNoContent: vi.fn(),
  locationAssign: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: mocks.signInSocial },
    signOut: mocks.signOut,
  },
}));

vi.mock("./client", () => ({
  fetchJson: vi.fn(),
  fetchNoContent: mocks.fetchNoContent,
}));

import { loginWithGoogle, logout } from "./auth";

describe("auth API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("starts Google login with the app home as the callback", async () => {
    mocks.signInSocial.mockResolvedValue({ data: null, error: null });

    await loginWithGoogle();

    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/",
    });
  });

  it("surfaces Google login and logout failures", async () => {
    mocks.signInSocial.mockResolvedValue({
      data: null,
      error: { message: "Provider unavailable" },
    });
    await expect(loginWithGoogle()).rejects.toThrow("Provider unavailable");

    mocks.signOut.mockResolvedValue({
      data: null,
      error: { message: "Logout unavailable" },
    });
    await expect(logout()).rejects.toThrow("Logout unavailable");
  });

  it("uses Spring login and logout endpoints in Spring Preview", async () => {
    vi.stubEnv("NEXT_PUBLIC_SPRING_BACKEND_ENABLED", "true");
    vi.stubGlobal("window", {
      location: { assign: mocks.locationAssign },
    });
    mocks.fetchNoContent.mockResolvedValue(undefined);

    await loginWithGoogle();
    await logout();

    expect(mocks.locationAssign).toHaveBeenCalledWith(
      "/api/auth/login/google",
    );
    expect(mocks.fetchNoContent).toHaveBeenCalledWith("/api/auth/logout", {
      method: "POST",
    });
    expect(mocks.signInSocial).not.toHaveBeenCalled();
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
});
