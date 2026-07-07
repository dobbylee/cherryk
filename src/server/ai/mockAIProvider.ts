import type { AIProvider } from "./provider";

export const mockAIProvider: AIProvider = {
  async extractKoreanTextFromImage() {
    return {
      extractedText: "오늘 친구 만났어요.",
      note: "Mock OCR output for local development.",
    };
  },

  async correctKorean(input) {
    return {
      correctedText: input.text.replace("친구 만났어요", "친구를 만났어요"),
      naturalText: input.text.replace("오늘 친구", "오늘은 친구"),
      explanationEn:
        "Use the object particle when the noun receives the action.",
      mistakes: [
        {
          tag: "particle_object",
          originalPart: "친구",
          correctedPart: "친구를",
          explanationEn: "친구 is the direct object of 만나다.",
          severity: "major",
        },
      ],
    };
  },

  async generateQuizDrafts(input) {
    return {
      questions: Array.from({ length: input.count }, () => ({
        tag: input.tag,
        difficulty: input.difficulty,
        questionEn: "Choose the correct particle.",
        sentenceKo: "저는 사과( ) 먹어요.",
        choices: [
          { text: "은", isCorrect: false },
          { text: "를", isCorrect: true },
          { text: "에", isCorrect: false },
          { text: "이", isCorrect: false },
        ],
        answerExplanationEn:
          "Use 를 because 사과 is the direct object of 먹어요.",
      })),
    };
  },
};
