import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AdminAuthError, requireAdminAccount } from "@/server/auth/admin";

export default async function AdminQuizzesLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();

  try {
    await requireAdminAccount(
      new Request("http://localhost/admin/quizzes", {
        headers: requestHeaders,
      }),
    );
  } catch (error) {
    if (error instanceof AdminAuthError) {
      return <AdminAccessMessage error={error} />;
    }

    throw error;
  }

  return children;
}

function AdminAccessMessage({ error }: { error: AdminAuthError }) {
  const isSignedOut = error.code === "unauthorized";
  const message =
    error.code === "admin_not_configured"
      ? "Admin access is not configured."
      : isSignedOut
        ? "Sign in with an approved Google account to continue."
        : "This Google account does not have admin access.";

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--foreground)]">
      <section className="mx-auto grid max-w-lg gap-4 border border-[var(--line)] bg-[var(--panel)] p-6 shadow-[0_18px_44px_rgb(32_143_202_/_8%)]">
        <p className="text-sm font-bold text-[var(--accent)]">
          Operator workflow
        </p>
        <h1 className="text-2xl font-semibold">Admin access</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">{message}</p>
        <Link
          className="flex h-11 items-center justify-center rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
          href="/"
        >
          {isSignedOut ? "Go to sign in" : "Back to app"}
        </Link>
      </section>
    </main>
  );
}
