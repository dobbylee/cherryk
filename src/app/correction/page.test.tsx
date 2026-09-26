// @vitest-environment jsdom

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CorrectionPage from "./page";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useAuthSession: vi.fn(),
  submitCorrection: vi.fn(),
  extractKoreanTextFromImage: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/correction",
}));
vi.mock("@/app/_hooks/use-auth-session", () => ({
  useAuthSession: mocks.useAuthSession,
}));
vi.mock("@/lib/api/corrections", () => ({
  submitCorrection: mocks.submitCorrection,
}));
vi.mock("@/lib/api/ocr", () => ({
  extractKoreanTextFromImage: mocks.extractKoreanTextFromImage,
}));

const originalText = "저는 학교에 공부했어요.";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("CorrectionPage request transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    mocks.useAuthSession.mockReturnValue({
      message: null,
      refresh: vi.fn(),
      signOut: vi.fn(async () => true),
      status: "authenticated",
      user: { id: "42", displayName: "Learner", level: "beginner" },
    });
  });

  afterEach(cleanup);

  it("keeps a rejected correction retryable and renders the later success", async () => {
    mocks.submitCorrection
      .mockRejectedValueOnce(new Error("Correction unavailable."))
      .mockResolvedValueOnce({
        correctionId: "91",
        originalText,
        correctedText: "저는 학교에서 공부했어요.",
        explanationEn: "Use 에서 for the action location.",
        mistakes: [],
        recommendedTags: [],
      });
    render(<CorrectionPage />);

    fireEvent.click(screen.getByRole("button", { name: /Review correction/i }));
    expect(await screen.findByText("Correction unavailable.")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: /Review correction/i }),
    ).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: /Review correction/i }));
    expect(
      await screen.findByText("Use 에서 for the action location."),
    ).toBeTruthy();
    expect(mocks.submitCorrection).toHaveBeenCalledTimes(2);
  });

  it("ignores a late OCR result after logout", async () => {
    const pendingOcr = deferred<{ extractedText: string }>();
    mocks.extractKoreanTextFromImage.mockReturnValue(pendingOcr.promise);
    render(<CorrectionPage />);

    const upload = screen.getByLabelText("Choose handwriting photo");
    fireEvent.change(upload, {
      target: {
        files: [new File(["image"], "writing.jpg", { type: "image/jpeg" })],
      },
    });
    expect(await screen.findByText("Extracting Korean text...")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Learner account menu" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));

    await act(async () => {
      pendingOcr.resolve({ extractedText: "늦게 도착한 결과" });
      await pendingOcr.promise;
    });
    expect(screen.getByRole("textbox", { name: "Korean text" })).toHaveProperty(
      "value",
      originalText,
    );
  });
});
