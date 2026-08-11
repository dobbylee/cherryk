"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
  getAdminQuizTagCounts,
  updateAdminQuiz,
} from "@/lib/api/adminQuizzes";
import { UserLevels, type UserLevel } from "@/lib/contracts/common";
import { GrammarTags, type GrammarTag } from "@/lib/contracts/grammar-tags";
import { type AdminQuizTagCount, type QuizType } from "@/lib/contracts/quiz";
import { invalidateLatestRequest, runLatestRequest } from "@/lib/latestRequest";

type FormStatus = "idle" | "loading";
type ReviewAction = "save" | "approve" | "reject" | null;
type MessageTone = "neutral" | "save" | "approve" | "reject" | "error";

export default function AdminQuizzesPage() {
  const [quizType, setQuizType] = useState<QuizType>("grammar");
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
  const [tagCounts, setTagCounts] = useState<AdminQuizTagCount[]>([]);
  const [tagCountStatus, setTagCountStatus] = useState<FormStatus>("loading");
  const [tagCountError, setTagCountError] = useState<string | null>(null);
  const tagCountRequestTracker = useRef(0);

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === activeDraftId) ?? null,
    [activeDraftId, drafts],
  );

  const refreshTagCounts = useCallback(async () => {
    setTagCountStatus("loading");
    setTagCountError(null);
    const result = await runLatestRequest(tagCountRequestTracker, () =>
      getAdminQuizTagCounts(),
    );
    if (result.status === "success") {
      setTagCounts(result.value.tagCounts);
      setTagCountStatus("idle");
    } else if (result.status === "error") {
      setTagCountError(
        result.error instanceof Error
          ? result.error.message
          : "Quiz counts could not be loaded.",
      );
      setTagCountStatus("idle");
    }
  }, []);

  useEffect(() => {
    const requestTracker = tagCountRequestTracker;
    void runLatestRequest(requestTracker, getAdminQuizTagCounts).then(
      (result) => {
        if (result.status === "success") {
          setTagCounts(result.value.tagCounts);
          setTagCountStatus("idle");
        } else if (result.status === "error") {
          setTagCountError(
            result.error instanceof Error
              ? result.error.message
              : "Quiz counts could not be loaded.",
          );
          setTagCountStatus("idle");
        }
      },
    );
    return () => invalidateLatestRequest(requestTracker);
  }, []);

  async function handleGenerateDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
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
      const response = await generateAdminQuizDrafts({
        quizType,
        tag: quizType === "vocabulary" ? "word_choice" : tag,
        difficulty,
        count,
        ...(trimmedInstruction ? { instruction: trimmedInstruction } : {}),
      });
      const generatedDrafts = response.drafts.map(toEditableAdminQuizDraft);
      setDrafts(generatedDrafts);
      setActiveDraftId(generatedDrafts[0]?.id ?? null);
      setIsEditing(false);
      await refreshTagCounts();
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
    if (!isEditing || !activeDraft || reviewAction !== null) {
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
      await updateAdminQuiz(activeDraft.id, update);
      setIsEditing(false);
      await refreshTagCounts();
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
    if (!activeDraft || reviewAction !== null) {
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
      await updateAdminQuiz(activeDraft.id, {
        ...update,
        status: "approved",
      });
      removeDraftFromQueue(activeDraft.id);
      await refreshTagCounts();
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
    if (!activeDraft || reviewAction !== null) {
      return;
    }

    setMessage(null);
    setReviewAction("reject");

    try {
      await deleteAdminQuizDraft(activeDraft.id);
      removeDraftFromQueue(activeDraft.id);
      await refreshTagCounts();
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

function QuizReviewPreview({ draft }: { draft: EditableAdminQuizDraft }) {
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

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function isValidDraftCount(count: number) {
  return Number.isInteger(count) && count >= 1 && count <= 20;
}
