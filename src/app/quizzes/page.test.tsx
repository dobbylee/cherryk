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
import QuizzesPage from "./page";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  useAuthSession: vi.fn(),
  fetchQuizRecommendations: vi.fn(),
  submitQuizAttempt: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/quizzes",
  useSearchParams: () => mocks.searchParams,
}));
vi.mock("@/app/_hooks/use-auth-session", () => ({
  useAuthSession: mocks.useAuthSession,
}));
vi.mock("@/lib/api/quizzes", () => ({
  fetchQuizRecommendations: mocks.fetchQuizRecommendations,
  submitQuizAttempt: mocks.submitQuizAttempt,
}));

const recommendation = {
  quizzes: [
    {
      id: "1",
      quizType: "grammar",
      tag: "particle_object",
      difficulty: "beginner",
      questionEn: "Choose the correct particle.",
      sentenceKo: "저는 사과( ) 먹어요.",
      choices: [
        { id: "11", text: "은" },
        { id: "12", text: "를" },
        { id: "13", text: "에" },
        { id: "14", text: "이" },
      ],
      attemptCount: 0,
    },
  ],
  availableTags: ["particle_object"],
  activeTags: [],
  progress: { solvedCount: 0, totalCount: 1, attemptCount: 0, correctCount: 0 },
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

describe("QuizzesPage request and URL transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = vi.fn();
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({ matches: false })),
    });
    mocks.searchParams = new URLSearchParams();
    mocks.useAuthSession.mockReturnValue({
      message: null,
      refresh: vi.fn(),
      signOut: vi.fn(async () => true),
      status: "authenticated",
      user: { id: "42", displayName: "Learner", level: "beginner" },
    });
  });

  afterEach(cleanup);

  it("ignores a recommendation that arrives after logout", async () => {
    const pending = deferred<typeof recommendation>();
    mocks.fetchQuizRecommendations.mockReturnValue(pending.promise);
    render(<QuizzesPage />);
    await waitFor(() =>
      expect(mocks.fetchQuizRecommendations).toHaveBeenCalledTimes(1),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Learner account menu" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/"));

    await act(async () => {
      pending.resolve(recommendation);
      await pending.promise;
    });
    expect(screen.queryByText("Choose the correct particle.")).toBeNull();
  });

  it("keeps explicit all-approved selection in the URL", async () => {
    mocks.fetchQuizRecommendations.mockResolvedValue(recommendation);
    render(<QuizzesPage />);
    expect(
      await screen.findByText("Choose the correct particle."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "All approved" }));
    expect(mocks.replace).toHaveBeenCalledWith("/quizzes?tags=", {
      scroll: false,
    });
  });

  it("submits one selected answer and updates progress after feedback", async () => {
    const pending = deferred<{
      isCorrect: boolean;
      correctChoiceId: string;
      explanationEn: string;
    }>();
    mocks.fetchQuizRecommendations.mockResolvedValue(recommendation);
    mocks.submitQuizAttempt.mockReturnValue(pending.promise);
    render(<QuizzesPage />);
    expect(
      await screen.findByText("Choose the correct particle."),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "를" }));
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByRole("button", { name: "Checking..." })).toHaveProperty(
      "disabled",
      true,
    );
    expect(mocks.submitQuizAttempt).toHaveBeenCalledWith({
      quizId: "1",
      selectedChoiceId: "12",
    });

    await act(async () => {
      pending.resolve({
        isCorrect: true,
        correctChoiceId: "12",
        explanationEn: "Use 를 for the object.",
      });
      await pending.promise;
    });
    expect(screen.getByText("Use 를 for the object.")).toBeTruthy();
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(mocks.submitQuizAttempt).toHaveBeenCalledTimes(1);
  });
});
