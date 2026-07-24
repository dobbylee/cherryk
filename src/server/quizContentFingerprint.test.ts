import { describe, expect, it } from "vitest";
import fingerprintFixture from "@/lib/contracts/fixtures/quiz-fingerprint.json";
import { createQuizContentFingerprint } from "./quizContentFingerprint";

const quiz = {
  tag: "particle_object",
  difficulty: "beginner",
  sentenceKo: "저는 사과( ) 먹어요.",
  choices: [
    { text: "은", isCorrect: false },
    { text: "를", isCorrect: true },
    { text: "에", isCorrect: false },
    { text: "이", isCorrect: false },
  ],
};

describe("createQuizContentFingerprint", () => {
  it("matches the shared Kotlin migration fixtures", () => {
    expect(fingerprintFixture.version).toBe(1);

    for (const testCase of fingerprintFixture.cases) {
      expect(createQuizContentFingerprint(testCase.input), testCase.name).toBe(
        testCase.expected,
      );
    }
  });

  it("ignores whitespace and choice ordering", () => {
    expect(
      createQuizContentFingerprint({
        ...quiz,
        sentenceKo: "  저는  사과( )\n먹어요.  ",
        choices: [...quiz.choices].reverse(),
      }),
    ).toBe(createQuizContentFingerprint(quiz));
  });

  it("distinguishes the correct answer and learning topic", () => {
    expect(
      createQuizContentFingerprint({
        ...quiz,
        choices: quiz.choices.map((choice) => ({
          ...choice,
          isCorrect: choice.text === "은",
        })),
      }),
    ).not.toBe(createQuizContentFingerprint(quiz));

    expect(
      createQuizContentFingerprint({
        ...quiz,
        tag: "particle_topic",
      }),
    ).not.toBe(createQuizContentFingerprint(quiz));
  });
});
