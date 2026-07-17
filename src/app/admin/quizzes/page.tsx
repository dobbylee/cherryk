"use client";

import { useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  buildAdminQuizUpdateRequest,
  toEditableAdminQuizDraft,
  type EditableAdminQuizChoice,
  type EditableAdminQuizDraft,
} from "@/lib/adminQuizReview";
import {
  deleteAdminQuizDraft,
  generateAdminQuizDrafts,
  updateAdminQuiz,
} from "@/lib/api/adminQuizzes";
import { UserLevels, type UserLevel } from "@/lib/contracts/common";
import { GrammarTags, type GrammarTag } from "@/lib/contracts/grammar-tags";

type FormStatus = "idle" | "loading";
type ReviewAction = "save" | "approve" | "reject" | null;
type MessageTone = "neutral" | "save" | "approve" | "reject" | "error";

export default function AdminQuizzesPage() {
  const [adminSecret, setAdminSecret] = useState("");
  const [tag, setTag] = useState<GrammarTag>("particle_object");
  const [difficulty, setDifficulty] = useState<UserLevel>("beginner");
  const [count, setCount] = useState(3);
  const [instruction, setInstruction] = useState("");
  const [drafts, setDrafts] = useState<EditableAdminQuizDraft[]>([]);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<FormStatus>("idle");
  const [reviewAction, setReviewAction] = useState<ReviewAction>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<MessageTone>("neutral");

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) ?? null,
    [activeDraftId, drafts],
  );

  async function handleGenerateDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSecret = adminSecret.trim();
    if (
      !trimmedSecret ||
      !isValidDraftCount(count) ||
      draftStatus === "loading" ||
      reviewAction !== null
    ) {
      return;
    }

    setMessage(null);
    setDraftStatus("loading");

    try {
      const trimmedInstruction = instruction.trim();
      const response = await generateAdminQuizDrafts(trimmedSecret, {
        tag,
        difficulty,
        count,
        ...(trimmedInstruction ? { instruction: trimmedInstruction } : {}),
      });
      const generatedDrafts = response.drafts.map(toEditableAdminQuizDraft);
      setDrafts(generatedDrafts);
      setActiveDraftId(generatedDrafts[0]?.id ?? null);
      setIsEditing(false);
      showMessage(
        generatedDrafts.length
          ? "Drafts generated. Review before approval."
          : "No drafts were generated.",
        "neutral",
      );
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Draft generation failed.",
        "error",
      );
    } finally {
      setDraftStatus("idle");
    }
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedSecret = adminSecret.trim();
    if (
      !isEditing ||
      !trimmedSecret ||
      !activeDraft ||
      reviewAction !== null
    ) {
      return;
    }

    const update = buildAdminQuizUpdateRequest(activeDraft);
    if (!update) {
      showMessage(
        "Fill every quiz field and select exactly one answer.",
        "error",
      );
      return;
    }

    setMessage(null);
    setReviewAction("save");

    try {
      await updateAdminQuiz(trimmedSecret, activeDraft.id, update);
      setIsEditing(false);
      showMessage("Changes saved.", "save");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Quiz update failed.",
        "error",
      );
    } finally {
      setReviewAction(null);
    }
  }

  async function handleApproveDraft() {
    const trimmedSecret = adminSecret.trim();
    if (!trimmedSecret || !activeDraft || reviewAction !== null) {
      return;
    }

    const update = buildAdminQuizUpdateRequest(activeDraft);
    if (!update) {
      showMessage(
        "Fill every quiz field and select exactly one answer.",
        "error",
      );
      return;
    }

    setMessage(null);
    setReviewAction("approve");

    try {
      await updateAdminQuiz(trimmedSecret, activeDraft.id, {
        ...update,
        status: "approved",
      });
      removeDraftFromQueue(activeDraft.id);
      showMessage("Quiz approved.", "approve");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Approval failed.",
        "error",
      );
    } finally {
      setReviewAction(null);
    }
  }

  async function handleRejectDraft() {
    const trimmedSecret = adminSecret.trim();
    if (!trimmedSecret || !activeDraft || reviewAction !== null) {
      return;
    }

    setMessage(null);
    setReviewAction("reject");

    try {
      await deleteAdminQuizDraft(trimmedSecret, activeDraft.id);
      removeDraftFromQueue(activeDraft.id);
      showMessage("Draft rejected and deleted.", "reject");
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : "Rejection failed.",
        "error",
      );
    } finally {
      setReviewAction(null);
    }
  }

  function removeDraftFromQueue(draftId: string) {
    const draftIndex = drafts.findIndex((draft) => draft.id === draftId);
    const remainingDrafts = drafts.filter((draft) => draft.id !== draftId);
    setDrafts(remainingDrafts);
    setIsEditing(false);
    setActiveDraftId(
      remainingDrafts[draftIndex]?.id ??
        remainingDrafts[draftIndex - 1]?.id ??
        null,
    );
  }

  function showMessage(text: string, tone: MessageTone) {
    setMessage(text);
    setMessageTone(tone);
  }

  function updateDraft(
    draftId: string,
    updater: (draft: EditableAdminQuizDraft) => EditableAdminQuizDraft,
  ) {
    setDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.id === draftId ? updater(draft) : draft,
      ),
    );
  }

  function updateActiveDraft(input: Partial<EditableAdminQuizDraft>) {
    if (!activeDraft) {
      return;
    }

    updateDraft(activeDraft.id, (draft) => ({
      ...draft,
      ...input,
    }));
  }

  function updateActiveChoice(
    index: number,
    input: Partial<EditableAdminQuizChoice>,
  ) {
    if (!activeDraft) {
      return;
    }

    updateDraft(activeDraft.id, (draft) => ({
      ...draft,
      choices: draft.choices.map((choice, choiceIndex) =>
        choiceIndex === index ? { ...choice, ...input } : choice,
      ),
    }));
  }

  function selectCorrectChoice(index: number) {
    if (!activeDraft) {
      return;
    }

    updateDraft(activeDraft.id, (draft) => ({
      ...draft,
      choices: draft.choices.map((choice, choiceIndex) => ({
        ...choice,
        isCorrect: choiceIndex === index,
      })),
    }));
  }

  return (
    <main className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-[var(--accent)]">
              Operator workflow
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal sm:text-3xl">
              Quiz review
            </h1>
          </div>
          <Link
            className="text-sm font-semibold text-[var(--accent-strong)]"
            href="/"
          >
            Back to app
          </Link>
        </header>

        {message ? (
          <div
            className={`rounded-md border bg-white px-3 py-2 text-sm font-semibold ${messageToneClassName(messageTone)}`}
            role="status"
          >
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <form
            className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]"
            onSubmit={handleGenerateDrafts}
          >
            <div className="border-b border-[var(--line)] pb-4">
              <p className="text-sm font-bold text-[var(--accent)]">AI draft</p>
              <h2 className="mt-1 text-xl font-semibold tracking-normal">
                Generate drafts
              </h2>
            </div>

            <div className="mt-4 grid gap-3">
              <Field label="Admin secret" htmlFor="admin-secret">
                <input
                  autoComplete="off"
                  className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                  id="admin-secret"
                  onChange={(event) => setAdminSecret(event.target.value)}
                  type="password"
                  value={adminSecret}
                />
              </Field>

              <Field label="Tag" htmlFor="quiz-tag">
                <select
                  className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
                  id="quiz-tag"
                  onChange={(event) => setTag(event.target.value as GrammarTag)}
                  value={tag}
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
                  className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
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
                  className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
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
                  className="min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white p-3 text-sm leading-6 outline-none focus:border-[var(--accent)]"
                  id="quiz-instruction"
                  onChange={(event) => setInstruction(event.target.value)}
                  value={instruction}
                />
              </Field>

              <button
                className="h-11 rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                disabled={
                  !adminSecret.trim() ||
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
            <div className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]">
              <div className="border-b border-[var(--line)] pb-4">
                <p className="text-sm font-bold text-[var(--accent)]">
                  Draft queue
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal">
                  Generated
                </h2>
              </div>
              <div className="mt-4 grid gap-2">
                {drafts.length ? (
                  drafts.map((draft, index) => (
                    <button
                      className={`rounded-md border bg-white p-3 text-left ${
                        draft.id === activeDraftId
                          ? "border-[var(--accent)]"
                          : "border-[var(--line)]"
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
              className="border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_18px_44px_rgb(32_143_202_/_7%)]"
              onSubmit={handleSaveDraft}
            >
              <div className="border-b border-[var(--line)] pb-4">
                <p className="text-sm font-bold text-[var(--accent)]">
                  Native review
                </p>
                <h2 className="mt-1 text-xl font-semibold tracking-normal">
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
                            className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
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
                            className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm"
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
                          className="h-11 w-full rounded-md border border-[var(--line)] bg-white px-3 text-base outline-none focus:border-[var(--accent)]"
                          id="draft-question"
                          onChange={(event) =>
                            updateActiveDraft({
                              questionEn: event.target.value,
                            })
                          }
                          value={activeDraft.questionEn}
                        />
                      </Field>

                      <Field label="Korean sentence" htmlFor="draft-sentence">
                        <textarea
                          className="min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white p-3 text-lg leading-8 outline-none focus:border-[var(--accent)]"
                          id="draft-sentence"
                          onChange={(event) =>
                            updateActiveDraft({
                              sentenceKo: event.target.value,
                            })
                          }
                          value={activeDraft.sentenceKo}
                        />
                      </Field>

                      <div>
                        <p className="text-sm font-semibold">Choices</p>
                        <div className="mt-2 grid gap-2">
                          {activeDraft.choices.map((choice, index) => (
                            <div
                              className="grid gap-2 rounded-md border border-[var(--line)] bg-white p-2 sm:grid-cols-[36px_minmax(0,1fr)] sm:items-center"
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
                                className="h-10 rounded-md border border-[var(--line)] px-3 text-base outline-none focus:border-[var(--accent)]"
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
                          className="min-h-24 w-full resize-y rounded-md border border-[var(--line)] bg-white p-3 text-sm leading-6 outline-none focus:border-[var(--accent)]"
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
                      className="h-11 rounded-md border border-[var(--accent)] bg-white px-4 text-sm font-semibold text-[var(--accent-strong)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                      disabled={
                        !isEditing ||
                        !adminSecret.trim() ||
                        draftStatus === "loading" ||
                        reviewAction !== null
                      }
                      hidden={!isEditing}
                      type="submit"
                    >
                      {reviewAction === "save" ? "Saving..." : "Save changes"}
                    </button>
                    <button
                      className="h-11 rounded-md border border-[var(--line)] bg-white px-4 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--accent-soft)] disabled:opacity-60"
                      disabled={
                        isEditing ||
                        !adminSecret.trim() ||
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
                      className="h-11 rounded-md border border-red-300 bg-white px-4 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      disabled={
                        !adminSecret.trim() ||
                        draftStatus === "loading" ||
                        reviewAction !== null
                      }
                      onClick={handleRejectDraft}
                      type="button"
                    >
                      {reviewAction === "reject" ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      className="h-11 rounded-md bg-[var(--accent)] px-4 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                      disabled={
                        !adminSecret.trim() ||
                        draftStatus === "loading" ||
                        reviewAction !== null
                      }
                      onClick={handleApproveDraft}
                      type="button"
                    >
                      {reviewAction === "approve"
                        ? "Approving..."
                        : "Approve"}
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

function QuizReviewPreview({ draft }: { draft: EditableAdminQuizDraft }) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2 text-xs font-semibold text-[var(--muted)]">
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

      <div className="rounded-md border border-[var(--line)] bg-white p-4 text-lg leading-8">
        {draft.sentenceKo}
      </div>

      <div className="grid gap-2">
        {draft.choices.map((choice, index) => (
          <div
            className={`rounded-md border px-3 py-2 text-sm ${
              choice.isCorrect
                ? "border-[var(--accent)] bg-[var(--accent-soft)] font-semibold"
                : "border-[var(--line)] bg-white"
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

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function messageToneClassName(tone: MessageTone) {
  if (tone === "save" || tone === "approve") {
    return "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]";
  }

  if (tone === "reject" || tone === "error") {
    return "border-red-300 bg-red-50 text-red-700";
  }

  return "border-[var(--line)] text-[var(--muted)]";
}

function isValidDraftCount(count: number) {
  return Number.isInteger(count) && count >= 1 && count <= 20;
}
