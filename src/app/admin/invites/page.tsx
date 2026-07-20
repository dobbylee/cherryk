"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import {
  createAdminInvite,
  fetchAdminInviteUsers,
} from "@/lib/api/adminInvites";
import type { AdminInviteUser } from "@/lib/contracts/invite";

type FormStatus = "idle" | "loading";

export default function AdminInvitesPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [label, setLabel] = useState("");
  const [users, setUsers] = useState<AdminInviteUser[]>([]);
  const [generatedLink, setGeneratedLink] = useState("");
  const [status, setStatus] = useState<FormStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreateInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSecret = adminSecret.trim();
    const trimmedLabel = label.trim();
    if (!trimmedSecret || !trimmedLabel || status === "loading") {
      return;
    }

    if (await createLink(trimmedSecret, { label: trimmedLabel })) {
      setLabel("");
    }
  }

  async function handleLoadUsers() {
    const trimmedSecret = adminSecret.trim();
    if (!trimmedSecret || status === "loading") {
      return;
    }

    setStatus("loading");
    setMessage(null);
    setGeneratedLink("");

    try {
      const response = await fetchAdminInviteUsers(trimmedSecret);
      setUsers(response.users);
      setMessage(
        response.users.length ? null : "No users are available for recovery.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Users failed to load.",
      );
    } finally {
      setStatus("idle");
    }
  }

  async function handleCreateRecovery(user: AdminInviteUser) {
    const trimmedSecret = adminSecret.trim();
    if (!trimmedSecret || status === "loading") {
      return;
    }

    await createLink(trimmedSecret, {
      label: `Recovery: ${user.displayName ?? user.id}`.slice(0, 80),
      userId: user.id,
    });
  }

  async function createLink(
    trimmedSecret: string,
    input: { label: string; userId?: string },
  ) {
    setStatus("loading");
    setMessage(null);
    setGeneratedLink("");

    try {
      const response = await createAdminInvite(trimmedSecret, input);
      setGeneratedLink(response.link);
      setMessage(
        response.kind === "invite"
          ? "One-time invite link created."
          : "One-time recovery link created.",
      );
      return true;
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Link creation failed.",
      );
      return false;
    } finally {
      setStatus("idle");
    }
  }

  async function handleCopyLink() {
    if (!generatedLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(generatedLink);
      setMessage("Link copied.");
    } catch {
      setMessage("Copy failed. Select and copy the link manually.");
    }
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--line)] pb-4">
          <div>
            <p className="text-sm font-bold text-[var(--accent)]">
              Operator workflow
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
              User invites
            </h1>
          </div>
          <div className="flex gap-3 text-sm font-semibold text-[var(--accent-strong)]">
            <Link href="/admin/quizzes">Quiz review</Link>
            <Link href="/">App</Link>
          </div>
        </header>

        {message ? (
          <div
            className="rounded-md border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--muted)]"
            role="status"
          >
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2">
          <form
            className="border border-[var(--line)] bg-[var(--panel)] p-4"
            onSubmit={handleCreateInvite}
          >
            <h2 className="text-xl font-semibold tracking-normal">
              New user invite
            </h2>
            <label
              className="mt-4 block text-sm font-semibold"
              htmlFor="admin-secret"
            >
              Admin secret
            </label>
            <input
              autoComplete="off"
              className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base"
              id="admin-secret"
              onChange={(event) => setAdminSecret(event.target.value)}
              type="password"
              value={adminSecret}
            />
            <label
              className="mt-4 block text-sm font-semibold"
              htmlFor="invite-label"
            >
              Label
            </label>
            <input
              className="mt-2 h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base"
              id="invite-label"
              maxLength={80}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="Who is this invite for?"
              value={label}
            />
            <button
              className="mt-4 h-11 w-full rounded-md border border-[var(--accent)] bg-[var(--accent)] px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={
                status === "loading" || !adminSecret.trim() || !label.trim()
              }
              type="submit"
            >
              Create invite link
            </button>
          </form>

          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-normal">
                Recovery links
              </h2>
              <button
                className="h-9 rounded-md border border-[var(--accent)] bg-white px-3 text-sm font-semibold text-[var(--accent-strong)] disabled:opacity-60"
                disabled={status === "loading" || !adminSecret.trim()}
                onClick={handleLoadUsers}
                type="button"
              >
                Load users
              </button>
            </div>
            <div className="mt-4 grid gap-2">
              {users.map((user) => (
                <div
                  className="flex items-center justify-between gap-3 border border-[var(--line)] bg-white p-3"
                  key={user.id}
                >
                  <span className="min-w-0 truncate text-sm font-semibold">
                    {user.displayName ?? "Unnamed user"} · {user.id.slice(0, 8)}
                  </span>
                  <button
                    className="h-9 shrink-0 rounded-md border border-[var(--accent)] px-3 text-xs font-semibold text-[var(--accent-strong)] disabled:opacity-60"
                    disabled={status === "loading"}
                    onClick={() => handleCreateRecovery(user)}
                    type="button"
                  >
                    Create recovery
                  </button>
                </div>
              ))}
            </div>
          </section>
        </section>

        {generatedLink ? (
          <section className="border border-[var(--line)] bg-[var(--panel)] p-4">
            <label className="text-sm font-semibold" htmlFor="generated-link">
              Share this link once
            </label>
            <div className="mt-2 flex gap-2">
              <input
                className="h-11 min-w-0 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                id="generated-link"
                readOnly
                value={generatedLink}
              />
              <button
                className="h-11 shrink-0 rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)]"
                onClick={handleCopyLink}
                type="button"
              >
                Copy
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
