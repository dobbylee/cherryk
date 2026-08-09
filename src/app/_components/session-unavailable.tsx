import Link from "next/link";
import { LogoMark, RefreshIcon } from "@/app/_components/icons";

export function SessionUnavailable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="app-shell grid min-h-screen place-items-center px-4 py-10">
      <section className="surface-card-elevated w-full max-w-md p-6 text-center sm:p-8">
        <LogoMark className="mx-auto h-11 w-11" />
        <p className="section-eyebrow mt-5">Connection interrupted</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
          We couldn&apos;t check your account
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]" role="status">
          {message}
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button className="button-primary" onClick={onRetry} type="button">
            <RefreshIcon className="h-4 w-4" />
            Try again
          </button>
          <Link className="button-secondary" href="/">
            Back to home
          </Link>
        </div>
      </section>
    </main>
  );
}
