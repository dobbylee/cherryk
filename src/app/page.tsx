"use client";

import Link from "next/link";
import { AppHeader } from "@/app/_components/app-header";
import {
  ArrowRightIcon,
  CameraIcon,
  CheckIcon,
  QuizIcon,
  SparkIcon,
  StreakIcon,
  WriteIcon,
} from "@/app/_components/icons";
import { useAuthSession } from "@/app/_hooks/use-auth-session";
import type { AuthUser } from "@/lib/contracts/auth";

export default function HomePage() {
  const {
    message,
    signIn,
    signOut,
    status: authStatus,
    user,
  } = useAuthSession();

  return (
    <main className="app-shell">
      <div className="app-container flex flex-col gap-5 sm:gap-7">
        <AppHeader
          authBusy={authStatus === "loading"}
          loginUnavailable={authStatus === "unavailable"}
          onLogin={() => void signIn()}
          onLogout={() => void signOut()}
          user={user}
        />

        {message && user ? <ErrorMessage message={message} /> : null}

        {user ? <LearnerDashboard user={user} /> : <GuestHome />}
      </div>
    </main>
  );
}

function GuestHome() {
  return (
    <>
      <section className="surface-card-elevated overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.12fr)_minmax(20rem,0.88fr)]">
          <div className="flex flex-col justify-center px-5 py-8 sm:px-9 sm:py-12 lg:px-12 lg:py-16">
            <p className="section-eyebrow">Korean learning, made clear</p>
            <h1 className="mt-4 max-w-2xl text-[clamp(2.4rem,8vw,4.6rem)] leading-[0.98] font-[740] tracking-[-0.055em] text-[var(--foreground)]">
              Build better Korean.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-7 text-[var(--muted)] sm:text-lg sm:leading-8">
              Write, review, and practice in one focused flow.
            </p>

            <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--line)] pt-5 text-sm font-semibold text-[var(--foreground-soft)]">
              <span className="inline-flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-[var(--accent)]" />
                Minimal corrections
              </span>
              <span className="inline-flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-[var(--accent)]" />
                Reviewed practice
              </span>
            </div>
          </div>

          <LearningFlowPreview />
        </div>
      </section>

      <section aria-labelledby="learning-paths-title" className="pt-3 sm:pt-5">
        <div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">A focused learning loop</p>
            <h2
              className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl"
              id="learning-paths-title"
            >
              From your words to real practice
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-[var(--muted)]">
            One calm workspace for writing, reviewing, and building confidence.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <CapabilityCard
            description="Write a sentence and receive only the changes you need, with a plain-English explanation."
            icon={<WriteIcon className="h-5 w-5" />}
            step="01"
            title="Write & correct"
          />
          <CapabilityCard
            description="Upload handwriting, confirm the extracted draft, and stay in control before correction."
            icon={<CameraIcon className="h-5 w-5" />}
            step="02"
            title="Scan & review"
          />
          <CapabilityCard
            description="Practice approved grammar and vocabulary questions based on what you are learning."
            icon={<QuizIcon className="h-5 w-5" />}
            step="03"
            title="Practice MCQ"
          />
        </div>
      </section>
    </>
  );
}

function LearnerDashboard({ user }: { user: AuthUser }) {
  const displayName = user.displayName || "Learner";

  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <div className="surface-card-elevated relative overflow-hidden p-6 sm:p-8 lg:p-10">
          <div
            aria-hidden="true"
            className="absolute -top-14 -right-14 h-44 w-44 rounded-full bg-[var(--accent-soft)]"
          />
          <div className="relative">
            <p className="section-eyebrow">Today&apos;s learning</p>
            <h1 className="mt-4 max-w-2xl text-3xl leading-tight font-[730] tracking-[-0.04em] sm:text-5xl">
              Welcome back, {displayName}.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)]">
              Choose one focused activity. A short correction or five reviewed
              questions is enough to keep moving.
            </p>
          </div>
        </div>

        <LearningRhythmCard />
      </section>

      <section aria-labelledby="practice-tools-title" className="pt-2">
        <div className="mb-4">
          <p className="section-eyebrow">Practice tools</p>
          <h2
            className="mt-2 text-2xl font-bold tracking-[-0.035em] sm:text-3xl"
            id="practice-tools-title"
          >
            What would you like to work on?
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <FeatureCard
            description="Write Korean text or upload handwriting. Review the corrected version and each change in one place."
            href="/correction"
            icon={<WriteIcon className="h-6 w-6" />}
            linkLabel="Start a correction"
            meta="Text · Handwriting OCR"
            title="Correction studio"
          />
          <FeatureCard
            description="Practice approved grammar and vocabulary questions, with clear feedback after every answer."
            href="/quizzes"
            icon={<QuizIcon className="h-6 w-6" />}
            linkLabel="Open practice"
            meta="Grammar · Vocabulary"
            title="MCQ practice"
          />
        </div>
      </section>
    </>
  );
}

function LearningFlowPreview() {
  const flow = [
    {
      description: "Start with a sentence",
      icon: <WriteIcon className="h-5 w-5" />,
      label: "Write",
    },
    {
      description: "Understand each change",
      icon: <SparkIcon className="h-5 w-5" />,
      label: "Review",
    },
    {
      description: "Make the lesson stick",
      icon: <QuizIcon className="h-5 w-5" />,
      label: "Practice",
    },
  ];

  return (
    <aside className="relative border-t border-[var(--line)] bg-[var(--panel-soft)] p-5 sm:p-8 lg:border-t-0 lg:border-l lg:p-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--foreground)]">
          A focused daily flow
        </p>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)] shadow-sm">
          10–15 min
        </span>
      </div>

      <ol className="mt-5 grid gap-2.5">
        {flow.map((item, index) => (
          <li
            className="flex items-center gap-3 rounded-2xl border border-[var(--line)] bg-white p-3.5 shadow-sm"
            key={item.label}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {item.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">{item.label}</span>
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {item.description}
              </span>
            </span>
            <span className="text-xs font-bold text-[var(--muted-light)]">
              0{index + 1}
            </span>
          </li>
        ))}
      </ol>

      <div className="mt-5 rounded-2xl bg-[var(--foreground)] p-4 text-white">
        <div className="flex items-center gap-2 text-sm font-bold">
          <StreakIcon className="h-5 w-5 text-[#ffad7d]" />
          Build a steady rhythm
        </div>
        <p className="mt-2 text-xs leading-5 text-white/70">
          Small sessions are easier to repeat—and easier to remember.
        </p>
      </div>
    </aside>
  );
}

function LearningRhythmCard() {
  return (
    <article className="surface-card flex flex-col justify-between overflow-hidden p-5 sm:p-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--warm-soft)] text-[var(--warm)]">
            <StreakIcon className="h-6 w-6" />
          </span>
          <span className="rounded-full border border-[var(--line)] bg-[var(--panel-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
            Coming soon
          </span>
        </div>
        <h2 className="mt-5 text-xl font-bold tracking-[-0.025em]">
          Build your learning rhythm
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          Short, regular sessions turn feedback into long-term progress.
        </p>
      </div>
      <div className="mt-6 grid grid-cols-7 gap-1.5" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5, 6].map((day) => (
          <span
            className="aspect-square rounded-lg border border-[var(--line)] bg-[var(--panel-soft)]"
            key={day}
          />
        ))}
      </div>
    </article>
  );
}

function FeatureCard({
  description,
  href,
  icon,
  linkLabel,
  meta,
  title,
}: {
  description: string;
  href: "/correction" | "/quizzes";
  icon: React.ReactNode;
  linkLabel: string;
  meta: string;
  title: string;
}) {
  return (
    <article className="surface-card group flex min-h-72 flex-col p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-strong)] transition-transform group-hover:-rotate-2 group-hover:scale-105">
          {icon}
        </span>
        <span className="rounded-full border border-[var(--line)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
          {meta}
        </span>
      </div>
      <h3 className="mt-6 text-2xl font-bold tracking-[-0.035em]">{title}</h3>
      <p className="mt-3 max-w-lg text-sm leading-7 text-[var(--muted)]">
        {description}
      </p>
      <Link className="button-primary mt-auto w-full sm:w-fit" href={href}>
        {linkLabel}
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </article>
  );
}

function CapabilityCard({
  description,
  icon,
  step,
  title,
}: {
  description: string;
  icon: React.ReactNode;
  step: string;
  title: string;
}) {
  return (
    <article className="surface-card flex min-h-56 flex-col p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent-strong)]">
          {icon}
        </span>
        <span className="text-xs font-bold tracking-[0.12em] text-[var(--muted-light)]">
          {step}
        </span>
      </div>
      <h3 className="mt-5 text-lg font-bold tracking-[-0.02em]">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
        {description}
      </p>
    </article>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="status-error" role="status">
      {message}
    </div>
  );
}
