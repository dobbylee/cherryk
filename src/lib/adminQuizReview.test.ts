import { describe, expect, it } from "vitest";
import {
  buildAdminQuizUpdateRequest,
  type EditableAdminQuizDraft,
} from "./adminQuizReview";

const editableDraft: EditableAdminQuizDraft = {
  id: "11111111-1111-4111-8111-111111111111",
  tag: "particle_object",
  difficulty: "beginner",
  questionEn: "Choose the correct particle.",
  sentenceKo: "저는 사과( ) 먹어요.",
  choices: [
    { text: "은", isCorrect: false },
    { text: "를", isCorrect: true },
    { text: "에", isCorrect: false },
    { text: "이", isCorrect: false },
  ],
  answerExplanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
  reviewNote: "",
  status: "approved",
};

describe("buildAdminQuizUpdateRequest", () => {
  it("includes empty review notes so operators can clear stale notes", () => {
    expect(buildAdminQuizUpdateRequest(editableDraft)).toMatchObject({
      reviewNote: "",
      status: "approved",
    });
  });

  it("trims quiz fields before update", () => {
    expect(
      buildAdminQuizUpdateRequest({
        ...editableDraft,
        questionEn: "  Choose the correct particle.  ",
        sentenceKo: "  저는 사과( ) 먹어요.  ",
        choices: [
          { text: " 은 ", isCorrect: false },
          { text: " 를 ", isCorrect: true },
          { text: " 에 ", isCorrect: false },
          { text: " 이 ", isCorrect: false },
        ],
        answerExplanationEn:
          "  Use 를 because 사과 is the direct object of 먹어요.  ",
        reviewNote: "  Ready.  ",
      }),
    ).toMatchObject({
      questionEn: "Choose the correct particle.",
      sentenceKo: "저는 사과( ) 먹어요.",
      choices: [
        { text: "은", isCorrect: false, sortOrder: 0 },
        { text: "를", isCorrect: true, sortOrder: 1 },
        { text: "에", isCorrect: false, sortOrder: 2 },
        { text: "이", isCorrect: false, sortOrder: 3 },
      ],
      answerExplanationEn: "Use 를 because 사과 is the direct object of 먹어요.",
      reviewNote: "Ready.",
    });
  });

  it("rejects updates without exactly one correct answer", () => {
    expect(
      buildAdminQuizUpdateRequest({
        ...editableDraft,
        choices: editableDraft.choices.map((choice) => ({
          ...choice,
          isCorrect: false,
        })),
      }),
    ).toBeNull();
  });
});
