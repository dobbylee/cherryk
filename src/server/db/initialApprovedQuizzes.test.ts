import { describe, expect, it } from "vitest";
import { z } from "zod";
import { QuizDraftOutputSchema } from "@/lib/contracts/quiz";
import { INITIAL_APPROVED_QUIZZES } from "./initialApprovedQuizzes";

const UuidSchema = z.uuid();

describe("INITIAL_APPROVED_QUIZZES", () => {
  it("contains two approved seed questions for each initial v1 tag", () => {
    expect(INITIAL_APPROVED_QUIZZES).toHaveLength(10);

    const countsByTag = new Map<string, number>();
    for (const quiz of INITIAL_APPROVED_QUIZZES) {
      countsByTag.set(quiz.tag, (countsByTag.get(quiz.tag) ?? 0) + 1);
    }

    expect(countsByTag).toEqual(
      new Map([
        ["particle_object", 2],
        ["particle_location", 2],
        ["particle_topic", 2],
        ["particle_subject", 2],
        ["verb_conjugation", 2],
      ]),
    );
  });

  it("uses unique stable UUIDs", () => {
    const ids = new Set<string>();

    for (const quiz of INITIAL_APPROVED_QUIZZES) {
      expect(UuidSchema.safeParse(quiz.id).success).toBe(true);
      expect(ids.has(quiz.id)).toBe(false);
      ids.add(quiz.id);

      for (const choice of quiz.choices) {
        expect(UuidSchema.safeParse(choice.id).success).toBe(true);
        expect(ids.has(choice.id)).toBe(false);
        ids.add(choice.id);
      }
    }
  });

  it("matches the reviewed MCQ draft contract before insertion", () => {
    expect(() =>
      QuizDraftOutputSchema.parse({
        questions: INITIAL_APPROVED_QUIZZES.map((quiz) => ({
          tag: quiz.tag,
          difficulty: quiz.difficulty,
          questionEn: quiz.questionEn,
          sentenceKo: quiz.sentenceKo,
          choices: quiz.choices.map((choice) => ({
            text: choice.text,
            isCorrect: choice.isCorrect,
          })),
          answerExplanationEn: quiz.answerExplanationEn,
        })),
      }),
    ).not.toThrow();
  });
});
