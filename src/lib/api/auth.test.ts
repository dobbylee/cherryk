import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInSocial: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    signIn: { social: mocks.signInSocial },
    signOut: mocks.signOut,
  },
}));

import { loginWithGoogle, logout } from "./auth";

describe("auth API helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
