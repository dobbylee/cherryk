"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { AppHeader } from "@/app/_components/app-header";
import { loginWithInvite } from "@/lib/api/auth";

type FormStatus = "idle" | "loading";

export default function JoinPage() {
  return (
    <Suspense fallback={<JoinLoadingPage />}>
      <JoinWorkspace />
    </Suspense>
  );
}

function JoinWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("invite")?.trim() ?? "";
  const recoveryCode = searchParams.get("recovery")?.trim() ?? "";
  const isRecovery = !inviteCode && !!recoveryCode;
  const accessCode = isRecovery ? recoveryCode : inviteCode;
  const hasValidLink = !!accessCode && !(inviteCode && recoveryCode);
  const [displayName, setDisplayName] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleContinue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedDisplayName = displayName.trim();
    if (
      !hasValidLink ||
      (!isRecovery && !trimmedDisplayName) ||
      status === "loading"
    ) {
      return;
    }

    setMessage(null);
    setStatus("loading");

    try {
      await loginWithInvite({
        inviteCode: accessCode,
        ...(!isRecovery ? { displayName: trimmedDisplayName } : {}),
      });
      router.replace("/");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Access failed.");
      setStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6">
        <AppHeader authBusy={status === "loading"} user={null} />

        {message ? <JoinMessage message={message} /> : null}

        <section className="border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_44px_rgb(32_143_202_/_8%)] sm:p-6">
          <p className="text-sm font-bold text-[var(--accent)]">
            {isRecovery ? "Recover access" : "Personal invite"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            {isRecovery ? "Continue to CherryK" : "Welcome to CherryK"}
          </h1>

          {hasValidLink ? (
            <form className="mt-5 grid gap-4" onSubmit={handleContinue}>
              {!isRecovery ? (
                <div>
                  <label
                    className="text-sm font-semibold"
                    htmlFor="display-name"
                  >
                    Display name
                  </label>
                  <input
                    autoComplete="name"
                    className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                    id="display-name"
                    maxLength={80}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Name or nickname"
                    required
                    value={displayName}
                  />
                </div>
              ) : (
                <p className="text-sm leading-6 text-[var(--muted)]">
                  This one-time recovery link will reconnect you to your
                  existing practice history.
                </p>
              )}
              <button
                className="h-11 rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] disabled:opacity-60"
                disabled={
                  status === "loading" || (!isRecovery && !displayName.trim())
                }
                type="submit"
              >
                {status === "loading"
                  ? "Checking..."
                  : isRecovery
                    ? "Recover access"
                    : "Start practicing"}
              </button>
            </form>
          ) : (
            <div className="mt-5 grid gap-3">
              <p className="text-sm leading-6 text-[var(--muted)]">
                This link is incomplete. Ask for a new personal invite or
                recovery link.
              </p>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)]"
                href="/"
              >
                Back to CherryK
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function JoinLoadingPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto w-full max-w-2xl px-4 py-4 sm:px-6 sm:py-6">
        <p className="text-sm text-[var(--muted)]" role="status">
          Loading invite...
        </p>
      </div>
    </main>
  );
}

function JoinMessage({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
      role="status"
    >
      {message}
    </div>
  );
}
