import { createHash } from "node:crypto";

type QuizContent = {
  tag: string;
  difficulty: string;
  sentenceKo: string;
  choices: {
    text: string;
    isCorrect: boolean;
  }[];
};

const FIELD_SEPARATOR = "\u001f";
const CHOICE_SEPARATOR = "\u001d";

export function createQuizContentFingerprint(input: QuizContent) {
  const choices = input.choices
    .map(
      (choice) =>
        `${normalizeQuizText(choice.text)}${CHOICE_SEPARATOR}${choice.isCorrect ? "1" : "0"}`,
    )
    .sort();
  const content = [
    input.tag,
    input.difficulty,
    normalizeQuizText(input.sentenceKo),
    ...choices,
  ].join(FIELD_SEPARATOR);

  return createHash("sha256").update(content, "utf8").digest("hex");
}

function normalizeQuizText(value: string) {
  return value.trim().replace(/[\t\n\f\r ]+/g, " ");
}
