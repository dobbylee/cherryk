"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { AppHeader } from "@/app/_components/app-header";
import { fetchCurrentUser, loginWithInvite, logout } from "@/lib/api/auth";
import type { AuthUser } from "@/lib/contracts/auth";

type FormStatus = "idle" | "loading";

export default function HomePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authStatus, setAuthStatus] = useState<FormStatus>("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadUser() {
      try {
        const response = await fetchCurrentUser();
        if (!ignore) {
          setUser(response.user);
        }
      } catch {
        if (!ignore) {
          setUser(null);
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
  }, []);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setAuthStatus("loading");

    try {
      const response = await loginWithInvite({
        inviteCode: inviteCode.trim(),
        displayName: displayName.trim() || undefined,
      });
      setUser(response.user);
      setInviteCode("");
      setDisplayName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setAuthStatus("idle");
    }
  }

  async function handleLogout() {
    setMessage(null);
    setAuthStatus("loading");

    try {
      await logout();
      setUser(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Logout failed.");
    } finally {
      setAuthStatus("idle");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <AppHeader
          authBusy={authStatus === "loading"}
          onLogout={handleLogout}
          user={user}
        />

        {message ? <ErrorMessage message={message} /> : null}

        {!user ? (
          <section className="grid pt-3 pb-6 sm:pt-4">
            <div className="grid gap-5 border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_44px_rgb(32_143_202_/_8%)] sm:p-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
              <div className="border-b border-[var(--line)] pb-5 lg:border-r lg:border-b-0 lg:pr-6 lg:pb-0">
                <p className="text-sm font-bold text-[var(--accent)]">
                  Correction / OCR / MCQ
                </p>
                <h2 className="mt-3 max-w-xl text-3xl leading-tight font-semibold tracking-normal sm:text-4xl">
                  Focused Korean writing practice.
                </h2>
                <div className="mt-5 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-3">
                  <span className="border-t border-[var(--line)] pt-3">
                    Direct text
                  </span>
                  <span className="border-t border-[var(--line)] pt-3">
                    OCR review
                  </span>
                  <span className="border-t border-[var(--line)] pt-3">
                    Approved MCQ
                  </span>
                </div>
              </div>
              <form className="grid gap-3" onSubmit={handleLogin}>
                <div>
                  <label
                    className="text-sm font-semibold"
                    htmlFor="invite-code"
                  >
                    Invite code
                  </label>
                  <input
                    autoComplete="off"
                    className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                    id="invite-code"
                    onChange={(event) => setInviteCode(event.target.value)}
                    placeholder="friend-dev-code"
                    value={inviteCode}
                  />
                </div>
                <div>
                  <label
                    className="text-sm font-semibold"
                    htmlFor="display-name"
                  >
                    Display name
                  </label>
                  <input
                    className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                    id="display-name"
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Friend"
                    value={displayName}
                  />
                </div>
                <button
                  className="h-11 rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] shadow-[inset_0_0_0_1px_rgb(255_255_255_/_75%)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                  disabled={authStatus === "loading" || !inviteCode.trim()}
                  type="submit"
                >
                  {authStatus === "loading" ? "Checking..." : "Login"}
                </button>
              </form>
            </div>
          </section>
        ) : (
          <section className="grid gap-4 pt-2 sm:grid-cols-2">
            <FeatureCard
              description="Write Korean text or upload handwriting, then review the correction directly below your input."
              eyebrow="Write and review"
              href={{ pathname: "/correction" }}
              linkLabel="Open Correction"
              title="Correction"
            />
            <FeatureCard
              description="Practice approved multiple-choice questions based on your correction history."
              eyebrow="Focused practice"
              href={{ pathname: "/quizzes" }}
              linkLabel="Open MCQ"
              title="MCQ"
            />
          </section>
        )}
      </div>
    </main>
  );
}

function FeatureCard({
  description,
  eyebrow,
  href,
  linkLabel,
  title,
}: {
  description: string;
  eyebrow: string;
  href: { pathname: "/correction" | "/quizzes" };
  linkLabel: string;
  title: string;
}) {
  return (
    <article className="flex min-h-64 flex-col border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_18px_44px_rgb(32_143_202_/_7%)] sm:p-6">
      <p className="text-sm font-bold text-[var(--accent)]">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal">{title}</h2>
      <p className="mt-4 max-w-md text-sm leading-7 text-[var(--muted)]">
        {description}
      </p>
      <Link
        className="mt-auto flex h-11 items-center justify-center rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
        href={href}
      >
        {linkLabel}
      </Link>
    </article>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
      role="status"
    >
      {message}
    </div>
  );
}
