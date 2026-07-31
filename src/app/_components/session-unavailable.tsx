export function SessionUnavailable({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid w-full max-w-4xl gap-3 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <p
          className="rounded-md border border-[var(--danger-line)] bg-[var(--danger-bg)] px-3 py-2 text-sm text-[var(--danger)]"
          role="status"
        >
          {message}
        </p>
        <button
          className="h-10 w-fit rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)]"
          onClick={onRetry}
          type="button"
        >
          Retry account check
        </button>
      </div>
    </main>
  );
}
