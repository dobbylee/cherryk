import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "@/app/_components/icons";

export function PolicyPage({
  children,
  description,
  eyebrow,
  title,
}: {
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <main className="app-shell">
      <div className="app-container flex max-w-3xl flex-col gap-5 sm:gap-7">
        <header className="border-b border-[var(--line)] pb-4 sm:min-h-14">
          <Link
            aria-label="CherryK home"
            className="inline-flex items-center gap-0.5"
            href="/"
          >
            <LogoMark className="h-9 w-9 shrink-0" />
            <span className="brand-wordmark text-[var(--foreground)]">
              Cherry<span className="text-[var(--brand-cherry)]">K</span>
            </span>
          </Link>
        </header>

        <article className="surface-card-elevated overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--panel-soft)] px-5 py-7 sm:px-9 sm:py-9">
            <p className="section-eyebrow">{eyebrow}</p>
            <h1 className="page-title mt-3">{title}</h1>
            <p className="page-description mt-4 max-w-2xl">{description}</p>
            <p className="mt-4 text-xs font-semibold tracking-wide text-[var(--muted)] uppercase">
              Effective August 20, 2026
            </p>
          </div>

          <div className="policy-content px-5 py-7 sm:px-9 sm:py-9">
            {children}
          </div>
        </article>
      </div>
    </main>
  );
}

export function PolicySection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
