"use client";

import { useLearningRhythm } from "@/app/_hooks/use-learning-rhythm";
import { StreakIcon } from "./icons";

export function LearningRhythmCard() {
  const { state, retry } = useLearningRhythm();
  const data = state.status === "ready" ? state.data : null;
  const activeToday = data?.days[6].active;

  return (
    <article
      className="surface-card flex flex-col justify-between overflow-hidden p-5 sm:p-6"
      aria-labelledby="learning-rhythm-title"
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
            <StreakIcon className="h-6 w-6" />
          </span>
          {data ? (
            <span className="rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
              {activeToday ? "Today complete" : "A fresh day to learn"}
            </span>
          ) : null}
        </div>
        <h2
          id="learning-rhythm-title"
          className="mt-5 text-xl font-bold tracking-[-0.025em]"
        >
          Your learning rhythm
        </h2>
        {state.status === "loading" ? (
          <p className="mt-3 text-sm text-[var(--muted)]" role="status">
            Loading your activity…
          </p>
        ) : null}
        {state.status === "error" ? (
          <div className="mt-3">
            <p className="text-sm text-[var(--muted)]" role="alert">
              We couldn’t load your learning activity.
            </p>
            <button
              type="button"
              className="button-secondary mt-3"
              onClick={retry}
            >
              Try again
            </button>
          </div>
        ) : null}
        {data ? (
          <>
            <p className="mt-3 text-3xl font-bold tracking-tight">
              {data.currentStreak}{" "}
              <span className="text-base font-semibold">
                {data.currentStreak === 1 ? "day" : "days"} in a row
              </span>
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {activeToday
                ? "You made time for Korean today."
                : data.currentStreak > 0
                  ? "Learn today to keep your streak going."
                  : "Start a streak with one correction or quiz answer."}
            </p>
          </>
        ) : null}
      </div>
      {data ? (
        <div className="mt-5">
          <ol
            className="grid grid-cols-7 gap-1.5"
            aria-label="Learning activity over the last seven days"
          >
            {data.days.map((day) => (
              <li
                key={day.date}
                className="min-w-0 text-center"
                aria-label={`${day.date}: ${day.active ? "Learning complete" : "No activity"}${day.date === data.today ? ", today" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex aspect-square items-center justify-center rounded-lg border text-sm font-bold ${day.active ? "border-[var(--accent)] bg-[var(--accent)] text-white" : "border-[var(--line)] bg-[var(--panel-soft)] text-[var(--muted)]"} ${day.date === data.today ? "ring-2 ring-[var(--warm)] ring-offset-2" : ""}`}
                >
                  {day.active ? "✓" : Number(day.date.slice(-2))}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-2 block text-[10px] text-[var(--muted)]"
                >
                  {new Date(`${day.date}T12:00:00Z`).toLocaleDateString(
                    "en-US",
                    { weekday: "short", timeZone: "UTC" },
                  )}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs leading-5 text-[var(--muted)]">
            A saved correction or quiz answer counts as a learning day.
          </p>
          <p className="mt-1 break-words text-xs text-[var(--muted-light)]">
            Your time zone: {data.timeZone.replaceAll("_", " ")}
          </p>
        </div>
      ) : null}
    </article>
  );
}
