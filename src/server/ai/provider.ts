import type {
  CorrectionAIOutput,
  CorrectionInput,
} from "@/lib/contracts/correction";
import type { OCRAIOutput } from "@/lib/contracts/ocr";
import type { QuizDraftInput, QuizDraftOutput } from "@/lib/contracts/quiz";

export interface AIProvider {
  extractKoreanTextFromImage(input: {
    imageBase64: string;
    imageMimeType: string;
  }): Promise<OCRAIOutput>;
  correctKorean(input: CorrectionInput): Promise<CorrectionAIOutput>;
  generateQuizDrafts(input: QuizDraftInput): Promise<QuizDraftOutput>;
}
