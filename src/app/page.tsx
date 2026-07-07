const practiceTags = [
  "particle_object",
  "particle_location",
  "verb_conjugation",
];

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-5 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
        <div>
          <p className="text-sm font-medium text-[var(--secondary)]">
            Invite-only MVP
          </p>
          <h1 className="text-2xl font-semibold tracking-normal">
            Korean Correction Coach
          </h1>
        </div>
        <button className="h-10 rounded-md bg-[var(--foreground)] px-4 text-sm font-semibold text-white">
          Login
        </button>
      </header>

      <section className="grid gap-4 sm:grid-cols-[1fr_220px]">
        <form className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <label className="text-sm font-semibold" htmlFor="korean-text">
            Write Korean
          </label>
          <textarea
            className="mt-3 min-h-40 w-full resize-y rounded-md border border-[var(--line)] bg-white p-3 text-base outline-none focus:border-[var(--accent)]"
            id="korean-text"
            placeholder="오늘 친구 만났어요."
          />
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <select className="h-11 rounded-md border border-[var(--line)] bg-white px-3 text-sm">
              <option>Beginner</option>
              <option>Lower intermediate</option>
              <option>Intermediate</option>
            </select>
            <button
              className="h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white"
              type="button"
            >
              Correct
            </button>
          </div>
        </form>

        <aside className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Practice Queue</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {practiceTags.map((tag) => (
              <span
                className="rounded-md border border-[var(--line)] px-2 py-1 text-xs text-[var(--muted)]"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
          <button className="mt-4 h-10 w-full rounded-md border border-[var(--line)] text-sm font-semibold">
            Practice MCQ
          </button>
        </aside>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Upload Handwriting</h2>
          <div className="mt-3 flex h-28 items-center justify-center rounded-md border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
            Image upload
          </div>
        </div>
        <div className="rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Admin Review</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Draft quizzes stay hidden until a Korean operator approves them.
          </p>
        </div>
      </section>
    </main>
  );
}
