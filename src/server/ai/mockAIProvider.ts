import type { AIProvider } from "./provider";

export const mockAIProvider: AIProvider = {
  async extractKoreanTextFromImage() {
    return {
      extractedText: "저는 학교에 공부했어요.",
      note: "Mock OCR output for local development.",
    };
  },

  async correctKorean(input) {
    const correctedText = input.text.replace(
      "학교에 공부했어요",
      "학교에서 공부했어요",
    );

    return {
      correctedText,
      naturalText: correctedText,
      explanationEn:
        "Use 에서 for the place where an action happens. 에 marks a destination.",
      mistakes: [
        {
          tag: "particle_location",
          originalPart: "학교에",
          correctedPart: "학교에서",
          explanationEn: "공부하다 happens at 학교, so use 에서.",
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
