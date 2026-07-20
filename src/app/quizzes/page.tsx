"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { AppHeader } from "@/app/_components/app-header";
import { fetchCurrentUser, logout } from "@/lib/api/auth";
import { fetchQuizRecommendations, submitQuizAttempt } from "@/lib/api/quizzes";
import type { AuthUser } from "@/lib/contracts/auth";
import { GrammarTags, type GrammarTag } from "@/lib/contracts/grammar-tags";
import type {
  QuizAttemptResponse,
  RecommendedQuiz,
} from "@/lib/contracts/quiz";

type FormStatus = "idle" | "loading";

const grammarTagSet = new Set<string>(GrammarTags);

export default function QuizzesPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <QuizWorkspace />
    </Suspense>
  );
}

function QuizWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<FormStatus>("loading");
  const [quizzes, setQuizzes] = useState<RecommendedQuiz[]>([]);
  const [availableTags, setAvailableTags] = useState<GrammarTag[]>([]);
  const [activeTags, setActiveTags] = useState<GrammarTag[]>([]);
  const [activeQuizIndex, setActiveQuizIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [quizAttempt, setQuizAttempt] = useState<QuizAttemptResponse | null>(
    null,
  );
  const [quizStatus, setQuizStatus] = useState<FormStatus>("idle");
  const [quizAttemptStatus, setQuizAttemptStatus] =
    useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const quizRequestIdRef = useRef(0);
  const initialLoadKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      try {
        const response = await fetchCurrentUser();
        if (ignore) {
          return;
        }
        if (!response.user) {
          router.replace("/");
          return;
        }
        setUser(response.user);
      } catch {
        if (!ignore) {
          router.replace("/");
        }
      } finally {
        if (!ignore) {
          setAuthStatus("idle");
        }
      }
    }

    void loadUser();

    return () => {
      ignore = true;
    };
  }, [router]);

  const hasExplicitTags = searchParams.has("tags");
  const requestedTags = useMemo(() => {
    if (!hasExplicitTags) {
      return undefined;
    }

    return Array.from(
      new Set(
        (searchParams.get("tags") ?? "")
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag): tag is GrammarTag => grammarTagSet.has(tag)),
      ),
    );
  }, [hasExplicitTags, searchParams]);
  const requestedTagsKey =
    requestedTags === undefined
      ? "history"
      : requestedTags.join(",") || "all";
  const selectedTags = hasExplicitTags
    ? (requestedTags ?? []).filter((tag) => availableTags.includes(tag))
    : activeTags;
  const activeQuiz = quizzes[activeQuizIndex] ?? null;
  const quizControlsBusy =
    authStatus === "loading" ||
    quizStatus === "loading" ||
    quizAttemptStatus === "loading";

  const handleLoadRecommendedQuizzes = useCallback(async () => {
    if (
      !user ||
      authStatus === "loading" ||
      quizStatus === "loading" ||
      quizAttemptStatus === "loading"
    ) {
      return;
    }

    setMessage(null);
    setQuizStatus("loading");
    setQuizAttemptStatus("idle");
    setSelectedChoiceId(null);
    setQuizAttempt(null);
    const requestId = quizRequestIdRef.current + 1;
    quizRequestIdRef.current = requestId;

    try {
      const response = await fetchQuizRecommendations(requestedTags);
      if (quizRequestIdRef.current === requestId) {
        setQuizzes(response.quizzes);
        setAvailableTags(response.availableTags);
        setActiveTags(response.activeTags);
        setActiveQuizIndex(0);
        setSelectedChoiceId(null);
        setQuizAttempt(null);
        setMessage(response.quizzes.length ? null : "No approved quizzes yet.");
      }
    } catch (error) {
      if (quizRequestIdRef.current === requestId) {
        setMessage(error instanceof Error ? error.message : "Practice failed.");
      }
    } finally {
      if (quizRequestIdRef.current === requestId) {
        setQuizStatus("idle");
      }
    }
  }, [authStatus, quizAttemptStatus, quizStatus, requestedTags, user]);

  useEffect(() => {
    if (!user || authStatus === "loading") {
      return;
    }

    const loadKey = `${user.id}:${requestedTagsKey}`;
    if (initialLoadKeyRef.current === loadKey) {
      return;
    }
    initialLoadKeyRef.current = loadKey;
    void handleLoadRecommendedQuizzes();
  }, [authStatus, handleLoadRecommendedQuizzes, requestedTagsKey, user]);

  async function handleLogout() {
    setMessage(null);
    setAuthStatus("loading");
    quizRequestIdRef.current += 1;
    setQuizStatus("idle");
    setQuizAttemptStatus("idle");

    try {
      await logout();
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Logout failed.");
      setAuthStatus("idle");
    }
  }

  async function handleQuizAttempt(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !activeQuiz ||
      !selectedChoiceId ||
      authStatus === "loading" ||
      quizStatus === "loading" ||
      quizAttemptStatus === "loading"
    ) {
      return;
    }

    setMessage(null);
    setQuizAttemptStatus("loading");
    const requestId = quizRequestIdRef.current + 1;
    quizRequestIdRef.current = requestId;

    try {
      const response = await submitQuizAttempt({
        quizId: activeQuiz.id,
        selectedChoiceId,
      });
      if (quizRequestIdRef.current === requestId) {
        setQuizAttempt(response);
      }
    } catch (error) {
      if (quizRequestIdRef.current === requestId) {
        setMessage(
          error instanceof Error ? error.message : "Quiz attempt failed.",
        );
      }
    } finally {
      if (quizRequestIdRef.current === requestId) {
        setQuizAttemptStatus("idle");
      }
    }
  }

  function handleNextQuiz() {
    setActiveQuizIndex((currentIndex) =>
      Math.min(currentIndex + 1, quizzes.length - 1),
    );
    setSelectedChoiceId(null);
    setQuizAttempt(null);
    setMessage(null);
  }

  function handleRestartPractice() {
    setActiveQuizIndex(0);
    setSelectedChoiceId(null);
    setQuizAttempt(null);
    setMessage(null);
  }

  function updateTagFilter(tags: GrammarTag[] | null) {
    const nextSearchParams = new URLSearchParams(searchParams.toString());

    if (tags === null) {
      nextSearchParams.delete("tags");
    } else {
      nextSearchParams.set("tags", tags.join(","));
    }

    const query = nextSearchParams.toString();
    router.replace(query ? `/quizzes?${query}` : "/quizzes", {
      scroll: false,
    });
  }

  function handleTagToggle(tag: GrammarTag) {
    const nextTags = new Set(selectedTags);

    if (nextTags.has(tag)) {
      nextTags.delete(tag);
    } else {
      nextTags.add(tag);
    }

    updateTagFilter(
      GrammarTags.filter((candidate) => nextTags.has(candidate)),
    );
  }

  if (!user) {
    return <LoadingPage />;
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <AppHeader
          authBusy={authStatus === "loading"}
          onLogout={handleLogout}
          user={user}
        />

        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[var(--accent)]">MCQ</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-normal">
              Practice approved questions
            </h2>
          </div>
          <Link
            className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-[var(--accent)] bg-white px-3 text-sm font-semibold text-[var(--accent-strong)] shadow-sm hover:bg-[var(--accent-soft)]"
            href="/"
          >
            All tools
          </Link>
        </div>

        <section className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_12px_30px_rgb(32_143_202_/_5%)]">
          <p className="text-sm font-semibold">Question tags</p>
          <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
            Recommended uses your correction history and falls back to all
            approved questions.
          </p>
          <div
            aria-label="Approved question filters"
            className="mt-3 flex flex-wrap gap-2"
          >
            <button
              aria-pressed={!hasExplicitTags}
              className={tagFilterClassName(!hasExplicitTags)}
              disabled={quizControlsBusy}
              onClick={() => updateTagFilter(null)}
              type="button"
            >
              Recommended
            </button>
            <button
              aria-pressed={hasExplicitTags && selectedTags.length === 0}
              className={tagFilterClassName(
                hasExplicitTags && selectedTags.length === 0,
              )}
              disabled={quizControlsBusy}
              onClick={() => updateTagFilter([])}
              type="button"
            >
              All approved
            </button>
            {availableTags.map((tag) => (
              <button
                aria-pressed={selectedTags.includes(tag)}
                className={tagFilterClassName(selectedTags.includes(tag))}
                disabled={quizControlsBusy}
                key={tag}
                onClick={() => handleTagToggle(tag)}
                type="button"
              >
                {formatTagLabel(tag)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
            {hasExplicitTags
              ? selectedTags.length
                ? "Showing approved questions for the selected tags."
                : "Showing all approved questions."
              : activeTags.length
                ? "Showing questions based on your correction history."
                : "No matching correction tags yet, so all approved questions are shown."}
          </p>
        </section>

        {message ? <Message message={message} /> : null}

        <section className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)] sm:p-5">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
            <div>
              <p className="text-sm font-bold text-[var(--accent)]">
                Practice queue
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal">
                Multiple choice
              </h2>
            </div>
            <button
              className="h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-60"
              disabled={
                authStatus === "loading" ||
                quizStatus === "loading" ||
                quizAttemptStatus === "loading"
              }
              onClick={handleLoadRecommendedQuizzes}
              type="button"
            >
              {quizStatus === "loading" ? "Loading..." : "Reload"}
            </button>
          </div>

          {activeQuiz ? (
            <form className="mt-5" onSubmit={handleQuizAttempt}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-[var(--muted)]">
                  {activeQuizIndex + 1} / {quizzes.length}
                </span>
                <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1 text-xs font-semibold text-[var(--secondary)]">
                  {activeQuiz.tag}
                </span>
              </div>
              <h3 className="mt-3 text-lg font-semibold tracking-normal">
                {activeQuiz.questionEn}
              </h3>
              <p className="mt-2 text-base leading-7 text-[var(--muted)]">
                {activeQuiz.sentenceKo}
              </p>
              <div className="mt-4 grid gap-2">
                {activeQuiz.choices.map((choice) => {
                  const isSelected = choice.id === selectedChoiceId;
                  const isCorrectChoice =
                    quizAttempt?.correctChoiceId === choice.id;
                  const isWrongSelected =
                    quizAttempt && isSelected && !isCorrectChoice;

                  return (
                    <button
                      className={`min-h-11 rounded-md border bg-white px-3 py-2 text-left text-sm font-semibold ${
                        isCorrectChoice
                          ? "border-[var(--accent)] text-[var(--accent-strong)]"
                          : isWrongSelected
                            ? "border-[var(--danger-line)] text-[var(--danger)]"
                            : isSelected
                              ? "border-[var(--accent)] text-[var(--foreground)]"
                              : "border-[var(--line)] text-[var(--foreground)]"
                      }`}
                      disabled={
                        !!quizAttempt ||
                        authStatus === "loading" ||
                        quizStatus === "loading" ||
                        quizAttemptStatus === "loading"
                      }
                      key={choice.id}
                      onClick={() => setSelectedChoiceId(choice.id)}
                      type="button"
                    >
                      {choice.text}
                    </button>
                  );
                })}
              </div>
              {quizAttempt ? (
                <div
                  className="mt-4 rounded-md border border-[var(--line)] bg-white p-3"
                  role="status"
                >
                  <p className="text-sm font-semibold">
                    {quizAttempt.isCorrect ? "Correct" : "Review"}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {quizAttempt.explanationEn}
                  </p>
                </div>
              ) : null}
              {quizAttempt && activeQuizIndex >= quizzes.length - 1 ? (
                <div
                  className="mt-4 rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] p-3"
                  role="status"
                >
                  <p className="text-sm font-semibold text-[var(--accent-strong)]">
                    Practice complete
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    You finished all {quizzes.length} questions in this set.
                  </p>
                </div>
              ) : null}
              <div className="mt-4 flex gap-2">
                <button
                  className="h-11 flex-1 rounded-md border border-[var(--accent)] bg-white px-3 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                  disabled={
                    !selectedChoiceId ||
                    !!quizAttempt ||
                    authStatus === "loading" ||
                    quizStatus === "loading" ||
                    quizAttemptStatus === "loading"
                  }
                  type="submit"
                >
                  {quizAttemptStatus === "loading" ? "Checking..." : "Check"}
                </button>
                {activeQuizIndex >= quizzes.length - 1 && quizAttempt ? (
                  <button
                    className="h-11 min-w-28 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)]"
                    onClick={handleRestartPractice}
                    type="button"
                  >
                    Practice again
                  </button>
                ) : (
                  <button
                    className="h-11 min-w-24 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white shadow-sm hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-50 sm:min-w-28"
                    disabled={
                      !quizAttempt ||
                      activeQuizIndex >= quizzes.length - 1 ||
                      authStatus === "loading" ||
                      quizStatus === "loading" ||
                      quizAttemptStatus === "loading"
                    }
                    onClick={handleNextQuiz}
                    type="button"
                  >
                    Next
                  </button>
                )}
              </div>
            </form>
          ) : quizStatus === "loading" ? (
            <p className="mt-5 text-sm text-[var(--muted)]" role="status">
              Loading approved questions...
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function LoadingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <p className="text-sm text-[var(--muted)]" role="status">
          Checking session...
        </p>
      </div>
    </main>
  );
}

function Message({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
      role="status"
    >
      {message}
    </div>
  );
}

function tagFilterClassName(isActive: boolean) {
  return `rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
    isActive
      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
      : "border-[var(--line)] bg-white text-[var(--secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
  }`;
}

function formatTagLabel(tag: GrammarTag) {
  return tag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
