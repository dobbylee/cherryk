import Link from "next/link";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { AdminAuthError, requireAdminAccount } from "@/lib/api/adminAccess";

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
  const message = isSignedOut
    ? "Sign in with an approved Google account to continue."
    : "This Google account does not have admin access.";

  return (
    <main className="app-shell grid min-h-screen place-items-center px-4 py-10">
      <section className="surface-card-elevated grid w-full max-w-lg gap-4 p-6 sm:p-8">
        <p className="section-eyebrow">Operator workspace</p>
        <h1 className="text-2xl font-bold tracking-[-0.03em]">Admin access</h1>
        <p className="text-sm leading-6 text-[var(--muted)]">{message}</p>
        <Link className="button-primary w-full" href="/">
          {isSignedOut ? "Go to sign in" : "Back to app"}
        </Link>
      </section>
    </main>
  );
}
