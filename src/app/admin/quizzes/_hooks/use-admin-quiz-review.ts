"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
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
import type { UserLevel } from "@/lib/contracts/common";
import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import type { AdminQuizTagCount, QuizType } from "@/lib/contracts/quiz";
import { invalidateLatestRequest, runLatestRequest } from "@/lib/latestRequest";
import { isValidDraftCount } from "../_lib/admin-quiz-count";

type FormStatus = "idle" | "loading";
type ReviewAction = "save" | "approve" | "reject" | null;
export type MessageTone = "neutral" | "save" | "approve" | "reject" | "error";

export function useAdminQuizReview() {
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

  return {
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
  };
}
