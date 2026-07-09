import type {
  AdminQuizDraft,
  AdminQuizUpdateRequest,
  QuizStatus,
} from "./contracts/quiz";

export type EditableAdminQuizChoice = {
  text: string;
  isCorrect: boolean;
};

export type EditableAdminQuizDraft = Omit<AdminQuizDraft, "choices"> & {
  choices: EditableAdminQuizChoice[];
  reviewNote: string;
  status: QuizStatus;
};

export function toEditableAdminQuizDraft(
  draft: AdminQuizDraft,
): EditableAdminQuizDraft {
  return {
    ...draft,
    choices: draft.choices.map((choice) => ({ ...choice })),
    reviewNote: "",
    status: "draft",
  };
}

export function buildAdminQuizUpdateRequest(
  draft: EditableAdminQuizDraft,
): AdminQuizUpdateRequest | null {
  const choices = draft.choices.map((choice, index) => ({
    text: choice.text.trim(),
    isCorrect: choice.isCorrect,
    sortOrder: index,
  }));

  if (
    !draft.questionEn.trim() ||
    !draft.sentenceKo.trim() ||
    !draft.answerExplanationEn.trim() ||
    choices.some((choice) => !choice.text) ||
    choices.filter((choice) => choice.isCorrect).length !== 1
  ) {
    return null;
  }

  return {
    tag: draft.tag,
    difficulty: draft.difficulty,
    questionEn: draft.questionEn.trim(),
    sentenceKo: draft.sentenceKo.trim(),
    choices,
    answerExplanationEn: draft.answerExplanationEn.trim(),
    status: draft.status,
    reviewNote: draft.reviewNote.trim(),
  };
}
