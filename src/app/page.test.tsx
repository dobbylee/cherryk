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
import HomePage from "./page";
import fixtures from "@/lib/contracts/fixtures/api-v1.json";

const mocks = vi.hoisted(() => ({
  useAuthSession: vi.fn(),
  fetchLearningRhythm: vi.fn(),
}));
vi.mock("@/app/_hooks/use-auth-session", () => ({
  useAuthSession: mocks.useAuthSession,
}));
vi.mock("@/lib/api/learning", () => ({
  fetchLearningRhythm: mocks.fetchLearningRhythm,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const rhythm = fixtures.learningRhythmResponse;
const user = { id: "42", displayName: "Learner", level: "beginner" };
function session(currentUser: typeof user | null = user) {
  mocks.useAuthSession.mockReturnValue({
    user: currentUser,
    status: currentUser ? "authenticated" : "anonymous",
    signIn: vi.fn(),
    signOut: vi.fn(),
    message: null,
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("home learning rhythm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    session();
    mocks.fetchLearningRhythm.mockResolvedValue(rhythm);
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not request private activity for guests", () => {
    session(null);
    render(<HomePage />);
    expect(mocks.fetchLearningRhythm).not.toHaveBeenCalled();
    expect(screen.queryByText("Your learning rhythm")).toBeNull();
  });

  it("shows loading then seven actual local days and the streak", async () => {
    const pending = deferred<typeof rhythm>();
    mocks.fetchLearningRhythm.mockReturnValue(pending.promise);
    render(<HomePage />);
    expect(screen.getByRole("status").textContent).toContain("Loading");
    await act(async () => pending.resolve(rhythm));
    expect(screen.getByText("Today complete")).toBeTruthy();
    expect(screen.getByText("days in a row").parentElement?.textContent).toBe(
      "2 days in a row",
    );
    expect(
      screen.getByRole("list", { name: /last seven days/ }).children,
    ).toHaveLength(7);
    expect(
      screen.getByLabelText("2026-09-29: Learning complete, today"),
    ).toBeTruthy();
  });

  it("offers retry after an error without displaying invented zero activity", async () => {
    mocks.fetchLearningRhythm.mockRejectedValueOnce(new Error("offline"));
    render(<HomePage />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("days in a row")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Today complete")).toBeTruthy();
  });

  it("shows an honest empty state", async () => {
    mocks.fetchLearningRhythm.mockResolvedValue({
      ...rhythm,
      currentStreak: 0,
      days: rhythm.days.map((day) => ({ ...day, active: false })),
    });
    render(<HomePage />);
    expect(
      await screen.findByText(
        "Start a streak with one correction or quiz answer.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("days in a row").parentElement?.textContent).toBe(
      "0 days in a row",
    );
  });

  it("aborts and ignores old responses after logout or an account change", async () => {
    const pending = deferred<typeof rhythm>();
    mocks.fetchLearningRhythm.mockReturnValueOnce(pending.promise);
    const view = render(<HomePage />);
    const signal = mocks.fetchLearningRhythm.mock.calls[0][1] as AbortSignal;
    session(null);
    view.rerender(<HomePage />);
    expect(signal.aborted).toBe(true);
    session({ ...user, id: "43" });
    mocks.fetchLearningRhythm.mockResolvedValue({
      ...rhythm,
      currentStreak: 7,
    });
    view.rerender(<HomePage />);
    await screen.findByText("Today complete");
    await act(async () => pending.resolve(rhythm));
    expect(screen.getByText("days in a row").parentElement?.textContent).toBe(
      "7 days in a row",
    );
  });

  it("refreshes on returning to the page and when the local day or zone changes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-29T12:00:00Z"));
    let zone = "Asia/Seoul";
    vi.spyOn(Intl, "DateTimeFormat").mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: zone }),
        }) as Intl.DateTimeFormat,
    );
    render(<HomePage />);
    await screen.findByText("Today complete");
    expect(mocks.fetchLearningRhythm.mock.calls[0][0]).toBe("Asia/Seoul");
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await waitFor(() =>
      expect(mocks.fetchLearningRhythm).toHaveBeenCalledTimes(2),
    );
    vi.setSystemTime(new Date("2026-09-30T12:00:00Z"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.fetchLearningRhythm).toHaveBeenCalledTimes(3);
    zone = "America/Los_Angeles";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(mocks.fetchLearningRhythm).toHaveBeenLastCalledWith(
      zone,
      expect.any(AbortSignal),
    );
  });
});
