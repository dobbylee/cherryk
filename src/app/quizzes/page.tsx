"use client";

import { Suspense } from "react";
import { AppHeader } from "@/app/_components/app-header";
import {
  ArrowRightIcon,
  CheckIcon,
  QuizIcon,
  RefreshIcon,
  SparkIcon,
} from "@/app/_components/icons";
import { SessionUnavailable } from "@/app/_components/session-unavailable";
import type { QuizProgress } from "@/lib/contracts/quiz";
import { useQuizPractice } from "./_hooks/use-quiz-practice";

export default function QuizzesPage() {
  return (
    <Suspense fallback={<LoadingPage />}>
      <QuizWorkspace />
    </Suspense>
  );
}

function QuizWorkspace() {
  const {
    authMessage,
    refreshAuth,
    authStatus,
    user,
    quizzes,
    availableTags,
    activeTags,
    progress,
    activeQuizIndex,
    selectedChoiceId,
    setSelectedChoiceId,
    quizAttempt,
    quizStatus,
    quizAttemptStatus,
    message,
    quizActionsRef,
    hasExplicitTags,
    quizType,
    selectedTags,
    activeQuiz,
    quizControlsBusy,
    handleLoadRecommendedQuizzes,
    handleLogout,
    handleQuizAttempt,
    handleNextQuiz,
    updateTagFilter,
    updateQuizType,
    handleTagToggle,
  } = useQuizPractice();

  if (!user) {
    if (authStatus === "unavailable") {
      return (
        <SessionUnavailable
          message={authMessage ?? "Authentication is unavailable."}
          onRetry={() => void refreshAuth()}
        />
      );
    }
    return <LoadingPage />;
  }

  return (
    <main className="app-shell">
      <div className="app-container flex max-w-5xl flex-col gap-5 sm:gap-6">
        <AppHeader
          authBusy={authStatus === "loading"}
          onLogout={handleLogout}
          user={user}
        />

        <div className="pt-1">
          <div className="min-w-0">
            <p className="section-eyebrow">MCQ practice</p>
            <h1 className="page-title mt-2">Turn feedback into fluency</h1>
            <p className="page-description mt-3 max-w-2xl">
              Practice with reviewed grammar and vocabulary questions. Every
              answer comes with clear feedback.
            </p>
          </div>
        </div>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              <SparkIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold">Choose a practice mode</p>
              <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
                Practice grammar in context or match Korean words to English
                definitions.
              </p>
            </div>
          </div>
          <div
            aria-label="Quiz type"
            className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--background-strong)] p-1.5"
          >
            {(["grammar", "vocabulary"] as const).map((type) => (
              <button
                aria-pressed={quizType === type}
                className={quizTypeClassName(quizType === type)}
                disabled={quizControlsBusy}
                key={type}
                onClick={() => updateQuizType(type)}
                type="button"
              >
                {formatTagLabel(type)}
              </button>
            ))}
          </div>
        </section>

        {quizType === "grammar" ? (
          <section className="surface-card p-5 sm:p-6">
            <p className="text-sm font-bold">Focus your practice</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted)]">
              Recommended uses your correction history and falls back to all
              approved questions.
            </p>
            <div
              aria-label="Approved question filters"
              className="mt-4 flex flex-wrap gap-2"
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
            <p className="mt-4 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--muted)]">
              {hasExplicitTags
                ? selectedTags.length
                  ? "Showing approved questions for the selected tags."
                  : "Showing all approved questions."
                : activeTags.length
                  ? "Showing questions based on your correction history."
                  : "No matching correction tags yet, so all approved questions are shown."}
            </p>
          </section>
        ) : null}

        {authMessage ? <Message message={authMessage} /> : null}
        {message ? <Message message={message} /> : null}

        <section className="surface-card-elevated overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] bg-[var(--panel-soft)] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                <QuizIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.08em] text-[var(--accent-strong)] uppercase">
                  Practice set
                </p>
                <h2 className="mt-0.5 text-lg font-bold tracking-[-0.02em]">
                  {quizType === "vocabulary" ? "Vocabulary" : "Grammar"}
                </h2>
              </div>
            </div>
            <button
              className="button-secondary px-3"
              disabled={
                authStatus === "loading" ||
                quizStatus === "loading" ||
                quizAttemptStatus === "loading"
              }
              onClick={handleLoadRecommendedQuizzes}
              type="button"
            >
              <RefreshIcon className="h-4 w-4" />
              {quizStatus === "loading" ? "Loading..." : "New set"}
            </button>
          </div>

          <div className="p-5 sm:p-6 lg:p-8">
            <div
              className="grid grid-cols-3 divide-x divide-[var(--line)] rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)]"
              aria-label="Quiz progress"
            >
              <ProgressStat
                label="Solved"
                value={`${progress.solvedCount} / ${progress.totalCount}`}
              />
              <ProgressStat
                label="Attempts"
                value={String(progress.attemptCount)}
              />
              <ProgressStat label="Accuracy" value={formatAccuracy(progress)} />
            </div>

            {activeQuiz ? (
              <form className="mt-6" onSubmit={handleQuizAttempt}>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-[var(--muted)]">
                    Question {activeQuizIndex + 1} of {quizzes.length}
                  </span>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                    {activeQuiz.quizType === "vocabulary"
                      ? "Vocabulary"
                      : formatTagLabel(activeQuiz.tag)}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--background-strong)]"
                >
                  <span
                    className="block h-full rounded-full bg-[var(--accent)] transition-[width]"
                    style={{
                      width: `${((activeQuizIndex + 1) / quizzes.length) * 100}%`,
                    }}
                  />
                </div>
                <h3 className="mt-6 text-xl leading-8 font-bold tracking-[-0.025em] sm:text-2xl">
                  {activeQuiz.questionEn}
                </h3>
                {activeQuiz.quizType === "grammar" ? (
                  <p className="mt-3 rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-lg leading-8 text-[var(--foreground-soft)] sm:p-5">
                    {activeQuiz.sentenceKo}
                  </p>
                ) : null}
                <div
                  aria-label="Answer choices"
                  className="mt-5 grid gap-2.5"
                  role="group"
                >
                  {activeQuiz.choices.map((choice, choiceIndex) => {
                    const isSelected = choice.id === selectedChoiceId;
                    const isCorrectChoice =
                      quizAttempt?.correctChoiceId === choice.id;
                    const isWrongSelected =
                      quizAttempt && isSelected && !isCorrectChoice;
                    const answerFeedback = isCorrectChoice
                      ? "Correct answer"
                      : isWrongSelected
                        ? "Your answer, incorrect"
                        : null;

                    return (
                      <button
                        aria-label={
                          answerFeedback
                            ? `${choice.text}. ${answerFeedback}.`
                            : choice.text
                        }
                        aria-pressed={isSelected}
                        className={`group flex min-h-14 items-center gap-3 rounded-xl border bg-white px-3 py-2.5 text-left text-sm font-semibold sm:px-4 ${
                          isCorrectChoice
                            ? "border-[var(--success)] bg-[var(--success-bg)] text-[var(--success)]"
                            : isWrongSelected
                              ? "border-[var(--danger)] bg-[var(--danger-bg)] text-[var(--danger)]"
                              : isSelected
                                ? "border-[var(--accent)] bg-[var(--accent-faint)] text-[var(--foreground)] shadow-[0_0_0_1px_var(--accent)]"
                                : "border-[var(--line-strong)] text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-faint)]"
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
                        <span
                          aria-hidden="true"
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-bold ${
                            isCorrectChoice
                              ? "border-[var(--success-line)] bg-white"
                              : isWrongSelected
                                ? "border-[var(--danger-line)] bg-white"
                                : isSelected
                                  ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                  : "border-[var(--line)] bg-[var(--panel-soft)] text-[var(--secondary)]"
                          }`}
                        >
                          {String.fromCharCode(65 + choiceIndex)}
                        </span>
                        <span className="min-w-0 flex-1">{choice.text}</span>
                        {answerFeedback ? (
                          <span className="flex shrink-0 items-center gap-1 text-xs font-bold">
                            {isCorrectChoice ? (
                              <CheckIcon className="h-4 w-4" />
                            ) : null}
                            {isCorrectChoice ? "Correct" : "Incorrect"}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                {quizAttempt ? (
                  <div
                    className={`mt-4 ${
                      quizAttempt.isCorrect ? "status-success" : "status-error"
                    }`}
                    role="status"
                  >
                    <p className="font-bold">
                      {quizAttempt.isCorrect ? "Correct" : "Let’s review"}
                    </p>
                    <p className="mt-1.5 leading-6">
                      {quizAttempt.explanationEn}
                    </p>
                  </div>
                ) : null}
                {quizAttempt && activeQuizIndex >= quizzes.length - 1 ? (
                  <div className="status-success mt-3" role="status">
                    <p className="font-bold">Practice complete</p>
                    <p className="mt-1 leading-6">
                      You finished all {quizzes.length} questions in this set.
                    </p>
                  </div>
                ) : null}
                <div
                  className="mt-5 grid scroll-mb-4 grid-cols-2 gap-2"
                  ref={quizActionsRef}
                >
                  <button
                    className="button-secondary w-full"
                    disabled={
                      !selectedChoiceId ||
                      !!quizAttempt ||
                      authStatus === "loading" ||
                      quizStatus === "loading" ||
                      quizAttemptStatus === "loading"
                    }
                    type="submit"
                  >
                    {quizAttemptStatus === "loading"
                      ? "Checking..."
                      : "Check answer"}
                  </button>
                  {activeQuizIndex >= quizzes.length - 1 && quizAttempt ? (
                    <button
                      className="button-primary w-full"
                      disabled={quizStatus === "loading"}
                      onClick={handleLoadRecommendedQuizzes}
                      type="button"
                    >
                      <RefreshIcon className="h-4 w-4" />
                      {quizStatus === "loading"
                        ? "Loading..."
                        : "Practice again"}
                    </button>
                  ) : (
                    <button
                      className="button-primary w-full"
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
                      Next question
                      <ArrowRightIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </form>
            ) : quizStatus === "loading" ? (
              <div className="flex items-center gap-3 py-8" role="status">
                <span
                  aria-hidden="true"
                  className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
                />
                <p className="text-sm font-semibold text-[var(--muted)]">
                  Loading approved questions...
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function LoadingPage() {
  return (
    <main className="app-shell grid min-h-screen place-items-center px-4">
      <div
        className="surface-card flex items-center gap-3 px-5 py-4"
        role="status"
      >
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent"
        />
        <p className="text-sm font-semibold text-[var(--muted)]">
          Preparing your practice...
        </p>
      </div>
    </main>
  );
}

function Message({ message }: { message: string }) {
  return (
    <div className="status-neutral" role="status">
      {message}
    </div>
  );
}

function ProgressStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-3 text-center sm:px-4 sm:py-4">
      <p className="text-xs font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-base font-bold text-[var(--foreground)] sm:text-lg">
        {value}
      </p>
    </div>
  );
}

function formatAccuracy(progress: QuizProgress) {
  if (progress.attemptCount === 0) {
    return "—";
  }

  return `${Math.round((progress.correctCount / progress.attemptCount) * 100)}%`;
}

function tagFilterClassName(isActive: boolean) {
  return `min-h-10 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60 ${
    isActive
      ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_var(--accent)]"
      : "border-[var(--line-strong)] bg-white text-[var(--secondary)] hover:border-[var(--accent)] hover:bg-[var(--accent-faint)]"
  }`;
}

function quizTypeClassName(isActive: boolean) {
  return `min-h-11 rounded-lg px-3 text-sm font-bold ${
    isActive
      ? "bg-white text-[var(--accent-strong)] shadow-sm"
      : "text-[var(--muted)] hover:bg-white/70 hover:text-[var(--foreground)]"
  }`;
}

function formatTagLabel(tag: string) {
  return tag
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
