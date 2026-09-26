import type { EditableAdminQuizDraft } from "@/lib/adminQuizReview";
import { formatLabel } from "../_lib/admin-quiz-label";

export function QuizReviewPreview({
  draft,
}: {
  draft: EditableAdminQuizDraft;
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1">
          {formatLabel(draft.quizType)}
        </span>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1">
          {formatLabel(draft.tag)}
        </span>
        <span className="rounded-full bg-[var(--accent-soft)] px-3 py-1">
          {formatLabel(draft.difficulty)}
        </span>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Question
        </p>
        <p className="mt-1 text-base font-semibold">{draft.questionEn}</p>
      </div>

      {draft.quizType === "grammar" ? (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-4 text-lg leading-8">
          {draft.sentenceKo}
        </div>
      ) : null}

      <div className="grid gap-2">
        {draft.choices.map((choice, index) => (
          <div
            className={`rounded-xl border px-3 py-2.5 text-sm ${
              choice.isCorrect
                ? "border-[var(--success)] bg-[var(--success-bg)] font-semibold text-[var(--success)]"
                : "border-[var(--line-strong)] bg-white"
            }`}
            key={index}
          >
            {String.fromCharCode(65 + index)}. {choice.text}
            {choice.isCorrect ? " · Correct" : ""}
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Explanation
        </p>
        <p className="mt-1 text-sm leading-6">{draft.answerExplanationEn}</p>
      </div>
    </div>
  );
}
