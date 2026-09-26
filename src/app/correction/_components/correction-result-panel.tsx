import Link from "next/link";
import type { Ref } from "react";
import { ArrowRightIcon, CopyIcon, QuizIcon } from "@/app/_components/icons";
import { buildCorrectionHighlightSegments } from "@/lib/correctionHighlights";
import type { CorrectionResponse } from "@/lib/contracts/correction";

export function CorrectionResultPanel({
  correction,
  copied,
  onCopy,
  resultRef,
}: {
  correction: CorrectionResponse;
  copied: boolean;
  onCopy: () => void;
  resultRef: Ref<HTMLElement>;
}) {
  return (
    <section className="grid scroll-mt-4 gap-4" ref={resultRef}>
      <article className="surface-card-elevated p-5 sm:p-7">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="section-eyebrow">Correction result</p>
            <h2 className="mt-2 text-2xl font-bold tracking-[-0.03em]">
              Your revised Korean
            </h2>
          </div>
          <button
            className="button-secondary w-full sm:w-auto"
            onClick={onCopy}
            type="button"
          >
            <CopyIcon className="h-4 w-4" />
            {copied ? "Copied" : "Copy text"}
          </button>
        </div>
        <dl className="mt-5 grid gap-4 text-sm md:grid-cols-2">
          <ResultBlock label="Original" value={correction.originalText} />
          <ResultBlock
            correctionChanges={correction.mistakes}
            label="Corrected"
            originalValue={correction.originalText}
            tone="accent"
            value={correction.correctedText}
          />
          <ResultBlock label="Explanation" value={correction.explanationEn} />
        </dl>
      </article>

      <article className="surface-card p-5 sm:p-7">
        <div className="border-b border-[var(--line)] pb-4">
          <p className="section-eyebrow">Review notes</p>
          <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">
            What changed and why
          </h2>
        </div>
        <div className="mt-4 grid gap-3">
          {correction.mistakes.map((mistake, index) => (
            <div
              className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4"
              key={`${mistake.tag}-${index}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                  {mistake.tag}
                </span>
                <span className="text-xs font-semibold text-[var(--muted)]">
                  {mistake.severity}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium">
                {mistake.originalPart} / {mistake.correctedPart}
              </p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {mistake.explanationEn}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-[var(--line)] pt-4">
          <div className="flex items-center gap-2">
            <QuizIcon className="h-5 w-5 text-[var(--accent)]" />
            <p className="text-sm font-bold">Practice this lesson</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {correction.recommendedTags.map((tag) => (
              <span
                className="mt-3 rounded-full border border-[var(--line)] bg-white px-3 py-1 text-xs font-semibold text-[var(--secondary)]"
                key={tag}
              >
                {tag}
              </span>
            ))}
          </div>
          <Link
            className="button-primary mt-4 w-full sm:w-fit"
            href={{
              pathname: "/quizzes",
              query: correction.recommendedTags.length
                ? { tags: correction.recommendedTags.join(",") }
                : undefined,
            }}
          >
            Practice related MCQ
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </article>
    </section>
  );
}

function ResultBlock({
  correctionChanges,
  label,
  originalValue,
  value,
  tone = "default",
}: {
  correctionChanges?: {
    originalPart: string;
    correctedPart: string;
  }[];
  label: string;
  originalValue?: string;
  value: string;
  tone?: "default" | "accent";
}) {
  const segments = correctionChanges
    ? buildCorrectionHighlightSegments(
        originalValue ?? "",
        value,
        correctionChanges,
      )
    : null;

  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
      <dt className="font-semibold">{label}</dt>
      <dd
        className={`mt-2 whitespace-pre-wrap leading-7 ${
          tone === "accent"
            ? "text-lg font-semibold text-[var(--foreground)]"
            : "text-[var(--muted)]"
        }`}
      >
        {segments
          ? segments.map((segment, index) => (
              <span
                className={
                  segment.highlighted
                    ? "font-bold text-[var(--accent-strong)]"
                    : undefined
                }
                key={`${segment.highlighted}-${index}`}
              >
                {segment.text}
              </span>
            ))
          : value}
      </dd>
    </div>
  );
}
