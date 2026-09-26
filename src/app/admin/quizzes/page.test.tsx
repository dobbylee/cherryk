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
import AdminQuizzesPage from "./page";

const mocks = vi.hoisted(() => ({
  getAdminQuizTagCounts: vi.fn(),
  generateAdminQuizDrafts: vi.fn(),
  updateAdminQuiz: vi.fn(),
  deleteAdminQuizDraft: vi.fn(),
}));

vi.mock("@/lib/api/adminQuizzes", () => mocks);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("AdminQuizzesPage generation transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminQuizTagCounts.mockResolvedValue({ tagCounts: [] });
  });

  afterEach(cleanup);

  it("prevents a duplicate generation request and permits retry after failure", async () => {
    const first = deferred<{ drafts: [] }>();
    mocks.generateAdminQuizDrafts
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce({ drafts: [] });
    render(<AdminQuizzesPage />);

    const generate = screen.getByRole("button", { name: "Generate" });
    fireEvent.click(generate);
    expect(
      screen.getByRole("button", { name: "Generating..." }),
    ).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Generating..." }));
    expect(mocks.generateAdminQuizDrafts).toHaveBeenCalledTimes(1);

    await act(async () => {
      first.reject(new Error("Draft generation failed."));
      await first.promise.catch(() => undefined);
    });
    expect(await screen.findByText("Draft generation failed.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));
    await waitFor(() =>
      expect(mocks.generateAdminQuizDrafts).toHaveBeenCalledTimes(2),
    );
    expect(await screen.findByText("No drafts were generated.")).toBeTruthy();
  });
});
