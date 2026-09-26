"use client";

import Link from "next/link";
import { UserLevels, type UserLevel } from "@/lib/contracts/common";
import { GrammarTags, type GrammarTag } from "@/lib/contracts/grammar-tags";
import type { QuizType } from "@/lib/contracts/quiz";
import { QuizReviewPreview } from "./_components/quiz-review-preview";
import {
  useAdminQuizReview,
  type MessageTone,
} from "./_hooks/use-admin-quiz-review";
import { isValidDraftCount } from "./_lib/admin-quiz-count";
import { formatLabel } from "./_lib/admin-quiz-label";

export default function AdminQuizzesPage() {
  const {
    quizType,
    setQuizType,
    tag,
    setTag,
    difficulty,
    setDifficulty,
    count,
    setCount,
    instruction,
    setInstruction,
    drafts,
    activeDraftId,
    setActiveDraftId,
    draftStatus,
    reviewAction,
    isEditing,
    setIsEditing,
    message,
    setMessage,
    messageTone,
    tagCounts,
    tagCountStatus,
    tagCountError,
    activeDraft,
    refreshTagCounts,
    handleGenerateDrafts,
    handleSaveDraft,
    handleApproveDraft,
    handleRejectDraft,
    updateActiveDraft,
    updateActiveChoice,
    selectCorrectChoice,
  } = useAdminQuizReview();

  return (
    <main className="app-shell">
      <div className="app-container flex flex-col gap-5 sm:gap-6">
        <header className="flex flex-col gap-4 border-b border-[var(--line)] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">Operator workspace</p>
            <h1 className="page-title mt-2">Quiz review</h1>
            <p className="page-description mt-2 max-w-xl">
              Generate, inspect, and approve learner-safe practice content.
            </p>
          </div>
          <Link className="button-secondary w-full sm:w-auto" href="/">
            Back to app
          </Link>
        </header>

        {message ? (
          <div
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${messageToneClassName(messageTone)}`}
            role="status"
          >
            {message}
          </div>
        ) : null}

        <section
          aria-labelledby="quiz-inventory-heading"
          className="surface-card overflow-hidden"
        >
          <div className="flex flex-col gap-3 border-b border-[var(--line)] p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="section-eyebrow">Quiz inventory</p>
              <h2
                className="mt-2 text-xl font-bold tracking-[-0.025em]"
                id="quiz-inventory-heading"
              >
                Current quizzes by tag
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Active approved quizzes and drafts. Retired history is excluded.
              </p>
            </div>
            <button
              className="button-secondary w-full sm:w-auto"
              disabled={tagCountStatus === "loading"}
              onClick={() => void refreshTagCounts()}
              type="button"
            >
              {tagCountStatus === "loading" ? "Refreshing..." : "Refresh"}
            </button>
          </div>

          {tagCountError ? (
            <p
              className="border-b border-[var(--danger-line)] bg-[var(--danger-bg)] px-5 py-3 text-sm font-semibold text-[var(--danger)]"
              role="status"
            >
              {tagCountError}
            </p>
          ) : null}

          {tagCounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-lg border-collapse text-left text-sm">
                <thead className="bg-[var(--panel-soft)] text-xs uppercase tracking-wide text-[var(--muted)]">
                  <tr>
                    <th className="px-5 py-3 font-semibold" scope="col">
                      Tag
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold"
                      scope="col"
                    >
                      Total
                    </th>
                    <th
                      className="px-4 py-3 text-right font-semibold"
                      scope="col"
                    >
                      Approved
                    </th>
                    <th
                      className="px-5 py-3 text-right font-semibold"
                      scope="col"
                    >
                      Drafts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line)]">
                  {tagCounts.map((count) => (
                    <tr key={count.tag}>
                      <th className="px-5 py-3 font-semibold" scope="row">
                        {formatLabel(count.tag)}
                      </th>
                      <td className="px-4 py-3 text-right font-bold">
                        {count.totalCount}
                      </td>
                      <td className="px-4 py-3 text-right text-[var(--muted)]">
                        {count.approvedCount}
                      </td>
                      <td className="px-5 py-3 text-right text-[var(--muted)]">
                        {count.draftCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : tagCountStatus === "loading" ? (
            <p className="p-5 text-sm text-[var(--muted)]" role="status">
              Loading quiz inventory...
            </p>
          ) : null}
        </section>

        <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <form
            className="surface-card h-fit p-5"
            onSubmit={handleGenerateDrafts}
          >
            <div className="border-b border-[var(--line)] pb-4">
              <p className="section-eyebrow">AI draft</p>
              <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">
                Generate drafts
              </h2>
            </div>

            <div className="mt-4 grid gap-3">
              <Field label="Quiz type" htmlFor="quiz-type">
                <select
                  className="form-control h-11 px-3 text-sm"
                  id="quiz-type"
                  onChange={(event) =>
                    setQuizType(event.target.value as QuizType)
                  }
                  value={quizType}
                >
                  <option value="grammar">Grammar</option>
                  <option value="vocabulary">Vocabulary</option>
                </select>
              </Field>

              <Field
                label={quizType === "vocabulary" ? "Tag (fixed)" : "Tag"}
                htmlFor="quiz-tag"
              >
                <select
                  className="form-control h-11 px-3 text-sm"
                  disabled={quizType === "vocabulary"}
                  id="quiz-tag"
                  onChange={(event) => setTag(event.target.value as GrammarTag)}
                  value={quizType === "vocabulary" ? "word_choice" : tag}
                >
                  {GrammarTags.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Difficulty" htmlFor="quiz-difficulty">
                <select
                  className="form-control h-11 px-3 text-sm"
                  id="quiz-difficulty"
                  onChange={(event) =>
                    setDifficulty(event.target.value as UserLevel)
                  }
                  value={difficulty}
                >
                  {UserLevels.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Count" htmlFor="quiz-count">
                <input
                  className="form-control h-11 px-3 text-base"
                  id="quiz-count"
                  max={20}
                  min={1}
                  onChange={(event) => setCount(Number(event.target.value))}
                  type="number"
                  value={count}
                />
              </Field>

              <Field label="Instruction" htmlFor="quiz-instruction">
                <textarea
                  className="form-control min-h-24 resize-y p-3 text-sm leading-6"
                  id="quiz-instruction"
                  onChange={(event) => setInstruction(event.target.value)}
                  value={instruction}
                />
              </Field>

              <button
                className="button-primary w-full"
                disabled={
                  !isValidDraftCount(count) ||
                  draftStatus === "loading" ||
                  reviewAction !== null
                }
                type="submit"
              >
                {draftStatus === "loading" ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>

          <section className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
            <div className="surface-card h-fit p-5">
              <div className="border-b border-[var(--line)] pb-4">
                <p className="section-eyebrow">Draft queue</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">
                  Generated
                </h2>
              </div>
              <div className="mt-4 grid gap-2">
                {drafts.length ? (
                  drafts.map((draft, index) => (
                    <button
                      className={`min-h-16 rounded-xl border bg-white p-3 text-left ${
                        draft.id === activeDraftId
                          ? "border-[var(--accent)] bg-[var(--accent-faint)] shadow-[0_0_0_1px_var(--accent)]"
                          : "border-[var(--line-strong)] hover:border-[var(--accent)]"
                      }`}
                      disabled={reviewAction !== null}
                      key={draft.id}
                      onClick={() => {
                        setActiveDraftId(draft.id);
                        setIsEditing(false);
                      }}
                      type="button"
                    >
                      <span className="text-xs font-semibold text-[var(--muted)]">
                        Draft {index + 1}
                      </span>
                      <span className="mt-2 line-clamp-2 block text-sm font-semibold">
                        {draft.questionEn}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    No generated drafts
                  </p>
                )}
              </div>
            </div>

            <form
              className="surface-card-elevated p-5 sm:p-6"
              onSubmit={handleSaveDraft}
            >
              <div className="border-b border-[var(--line)] pb-4">
                <p className="section-eyebrow">Native review</p>
                <h2 className="mt-2 text-xl font-bold tracking-[-0.025em]">
                  Edit and approve
                </h2>
              </div>

              {activeDraft ? (
                <div className="mt-4 grid gap-4">
                  {isEditing ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Tag" htmlFor="draft-tag">
                          <select
                            className="form-control h-11 px-3 text-sm"
                            disabled={activeDraft.quizType === "vocabulary"}
                            id="draft-tag"
                            onChange={(event) =>
                              updateActiveDraft({
                                tag: event.target.value as GrammarTag,
                              })
                            }
                            value={activeDraft.tag}
                          >
                            {GrammarTags.map((option) => (
                              <option key={option} value={option}>
                                {formatLabel(option)}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Difficulty" htmlFor="draft-difficulty">
                          <select
                            className="form-control h-11 px-3 text-sm"
                            id="draft-difficulty"
                            onChange={(event) =>
                              updateActiveDraft({
                                difficulty: event.target.value as UserLevel,
                              })
                            }
                            value={activeDraft.difficulty}
                          >
                            {UserLevels.map((option) => (
                              <option key={option} value={option}>
                                {formatLabel(option)}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>

                      <Field label="Question" htmlFor="draft-question">
                        <input
                          className="form-control h-11 px-3 text-base"
                          id="draft-question"
                          onChange={(event) =>
                            updateActiveDraft({
                              questionEn: event.target.value,
                            })
                          }
                          value={activeDraft.questionEn}
                        />
                      </Field>

                      {activeDraft.quizType === "grammar" ? (
                        <Field label="Korean sentence" htmlFor="draft-sentence">
                          <textarea
                            className="form-control min-h-24 resize-y p-3 text-lg leading-8"
                            id="draft-sentence"
                            onChange={(event) =>
                              updateActiveDraft({
                                sentenceKo: event.target.value,
                              })
                            }
                            value={activeDraft.sentenceKo ?? ""}
                          />
                        </Field>
                      ) : null}

                      <div>
                        <p className="text-sm font-semibold">Choices</p>
                        <div className="mt-2 grid gap-2">
                          {activeDraft.choices.map((choice, index) => (
                            <div
                              className="grid gap-2 rounded-xl border border-[var(--line)] bg-[var(--panel-soft)] p-2 sm:grid-cols-[36px_minmax(0,1fr)] sm:items-center"
                              key={index}
                            >
                              <input
                                aria-label={`Correct choice ${index + 1}`}
                                checked={choice.isCorrect}
                                className="h-5 w-5"
                                onChange={() => selectCorrectChoice(index)}
                                type="radio"
                              />
                              <input
                                className="form-control h-10 px-3 text-base"
                                onChange={(event) =>
                                  updateActiveChoice(index, {
                                    text: event.target.value,
                                  })
                                }
                                value={choice.text}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <Field label="Explanation" htmlFor="draft-explanation">
                        <textarea
                          className="form-control min-h-24 resize-y p-3 text-sm leading-6"
                          id="draft-explanation"
                          onChange={(event) =>
                            updateActiveDraft({
                              answerExplanationEn: event.target.value,
                            })
                          }
                          value={activeDraft.answerExplanationEn}
                        />
                      </Field>
                    </>
                  ) : (
                    <QuizReviewPreview draft={activeDraft} />
                  )}

                  <div className="grid gap-2 sm:grid-cols-3">
                    <button
                      className="button-secondary w-full"
                      disabled={
                        !isEditing ||
                        draftStatus === "loading" ||
                        reviewAction !== null
                      }
                      hidden={!isEditing}
                      type="submit"
                    >
                      {reviewAction === "save" ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      className="button-secondary w-full"
                      disabled={
                        isEditing ||
                        draftStatus === "loading" ||
                        reviewAction !== null
                      }
                      hidden={isEditing}
                      onClick={(event) => {
                        event.preventDefault();
                        setMessage(null);
                        setIsEditing(true);
                      }}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className="button-danger w-full"
                      disabled={
                        draftStatus === "loading" || reviewAction !== null
                      }
                      onClick={handleRejectDraft}
                      type="button"
                    >
                      {reviewAction === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      className="button-primary w-full"
                      disabled={
                        draftStatus === "loading" || reviewAction !== null
                      }
                      onClick={handleApproveDraft}
                      type="button"
                    >
                      {reviewAction === "approve" ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--muted)]">
                  Generate drafts, then choose one to review.
                </p>
              )}
            </form>
          </section>
        </section>
      </div>
    </main>
  );
}

function Field({
  children,
  htmlFor,
  label,
}: {
  children: React.ReactNode;
  htmlFor: string;
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold" htmlFor={htmlFor}>
      {label}
      {children}
    </label>
  );
}

function messageToneClassName(tone: MessageTone) {
  if (tone === "save" || tone === "approve") {
    return "border-[var(--success-line)] bg-[var(--success-bg)] text-[var(--success)]";
  }

  if (tone === "reject" || tone === "error") {
    return "border-[var(--danger-line)] bg-[var(--danger-bg)] text-[var(--danger)]";
  }

  return "border-[var(--line)] bg-white text-[var(--muted)]";
}
