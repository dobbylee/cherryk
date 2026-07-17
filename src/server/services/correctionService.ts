import type { AuthUser } from "@/lib/contracts/auth";
import {
  CorrectionAIOutputSchema,
  CorrectionResponseSchema,
  type CorrectionAIOutput,
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

      const normalizedOutput = normalizeCorrectionOutput(
        input.text,
        parsed.data,
      );
      const recommendedTags = uniqueTags(
        normalizedOutput.mistakes.map((mistake) => mistake.tag),
      );
      const { correctionId } = await repository.createCorrectionRecord({
        userId: user.id,
        inputType: input.inputType,
        originalText: input.text,
        aiOutput: normalizedOutput,
        recommendedTags,
        now: now(),
      });

      return CorrectionResponseSchema.parse({
        correctionId,
        originalText: input.text,
        ...normalizedOutput,
        recommendedTags,
      });
    },
  };
}

function normalizeCorrectionOutput(
  originalText: string,
  output: CorrectionAIOutput,
): CorrectionAIOutput {
  if (
    normalizeWhitespace(originalText) ===
    normalizeWhitespace(output.correctedText)
  ) {
    return {
      correctedText: originalText,
      explanationEn: "No corrections were needed.",
      mistakes: [],
    };
  }

  const originalIsKorean = containsHangul(originalText);
  if (
    originalIsKorean &&
    !isAcceptablyKoreanOutput(output.correctedText, originalText)
  ) {
    throw new CorrectionServiceError(
      "invalid_ai_output",
      "AI correction output is invalid.",
    );
  }

  return {
    ...output,
    mistakes: output.mistakes.filter((mistake) => {
      const describesChange = mistake.originalPart !== mistake.correctedPart;
      const matchesOriginal =
        mistake.originalPart.length === 0 ||
        originalText.includes(mistake.originalPart);
      const matchesCorrection =
        mistake.correctedPart.length === 0 ||
        output.correctedText.includes(mistake.correctedPart);

      return describesChange && matchesOriginal && matchesCorrection;
    }),
  };
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

function containsHangul(value: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/u.test(value);
}

function isAcceptablyKoreanOutput(value: string, originalText: string) {
  const outputStats = getLanguageStats(value);
  if (outputStats.hangulCount === 0) {
    return false;
  }

  const originalLatinWords = new Set(
    getLanguageStats(originalText).latinWords.map((word) => word.toLowerCase()),
  );
  const introducesEnglish = outputStats.latinWords.some(
    (word) => !originalLatinWords.has(word.toLowerCase()),
  );
  if (introducesEnglish) {
    return false;
  }

  if (outputStats.hangulRuns >= outputStats.latinRuns) {
    return true;
  }

  const originalStats = getLanguageStats(originalText);
  if (originalStats.latinRuns === 0) {
    return false;
  }

  return (
    outputStats.hangulCount / outputStats.latinRuns >=
    originalStats.hangulCount / originalStats.latinRuns
  );
}

function getLanguageStats(value: string) {
  const latinWords = value.match(/[A-Za-z]+/gu) ?? [];

  return {
    hangulCount: Array.from(value).filter((character) =>
      /[ㄱ-ㅎㅏ-ㅣ가-힣]/u.test(character),
    ).length,
    hangulRuns: value.match(/[ㄱ-ㅎㅏ-ㅣ가-힣]+/gu)?.length ?? 0,
    latinRuns: latinWords.length,
    latinWords,
  };
}

function uniqueTags(tags: GrammarTag[]) {
  return Array.from(new Set(tags));
}
