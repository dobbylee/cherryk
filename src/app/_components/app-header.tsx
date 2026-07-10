import Link from "next/link";
import type { AuthUser } from "@/lib/contracts/auth";

export function AppHeader({
  authBusy,
  onLogout,
  user,
}: {
  authBusy: boolean;
  onLogout: () => void;
  user: AuthUser | null;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
      <Link href="/">
        <h1 className="text-2xl font-semibold tracking-normal text-[var(--foreground)] sm:text-3xl">
          CherryK
        </h1>
      </Link>
      {user ? (
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <p className="min-w-0 text-sm font-medium text-[var(--muted)]">
            {user.displayName || "Friend"}
          </p>
          <button
            className="h-10 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] hover:border-[var(--accent)] disabled:opacity-60"
            disabled={authBusy}
            onClick={onLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      ) : null}
    </header>
  );
}
