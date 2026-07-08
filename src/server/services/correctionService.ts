import type { AuthUser } from "@/lib/contracts/auth";
import {
  CorrectionAIOutputSchema,
  CorrectionResponseSchema,
  type CorrectionInput,
  type CorrectionResponse,
} from "@/lib/contracts/correction";
import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import type { AIProvider } from "@/server/ai/provider";
import type { CorrectionRepository } from "@/server/repositories/correctionRepository";

export class CorrectionServiceError extends Error {
  constructor(
    readonly code: "invalid_ai_output",
    message: string,
  ) {
    super(message);
    this.name = "CorrectionServiceError";
  }
}

type CorrectionServiceOptions = {
  now?: () => Date;
};

export function createCorrectionService(
  repository: CorrectionRepository,
  aiProvider: AIProvider,
  options: CorrectionServiceOptions = {},
) {
  const now = options.now ?? (() => new Date());

  return {
    async correctKorean(
      user: AuthUser,
      input: CorrectionInput,
    ): Promise<CorrectionResponse> {
      const aiResult = await aiProvider.correctKorean(input);
      const parsed = CorrectionAIOutputSchema.safeParse(aiResult);

      if (!parsed.success) {
        throw new CorrectionServiceError(
          "invalid_ai_output",
          "AI correction output is invalid.",
        );
      }

      const recommendedTags = uniqueTags(
        parsed.data.mistakes.map((mistake) => mistake.tag),
      );
      const { correctionId } = await repository.createCorrectionRecord({
        userId: user.id,
        inputType: input.inputType,
        originalText: input.text,
        extractedText: input.extractedText,
        aiOutput: parsed.data,
        recommendedTags,
        now: now(),
      });

      return CorrectionResponseSchema.parse({
        correctionId,
        originalText: input.text,
        correctedText: parsed.data.correctedText,
        naturalText: parsed.data.naturalText,
        explanationEn: parsed.data.explanationEn,
        mistakes: parsed.data.mistakes,
        recommendedTags,
      });
    },
  };
}

function uniqueTags(tags: GrammarTag[]) {
  return Array.from(new Set(tags));
}
