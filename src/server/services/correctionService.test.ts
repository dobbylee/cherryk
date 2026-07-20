import { describe, expect, it, vi } from "vitest";
import type { AuthUser } from "@/lib/contracts/auth";
import type { CorrectionAIOutput } from "@/lib/contracts/correction";
import type { AIProvider } from "@/server/ai/provider";
import type {
  CorrectionRepository,
  CreateCorrectionRecordInput,
} from "@/server/repositories/correctionRepository";
import {
  CorrectionServiceError,
  createCorrectionService,
} from "./correctionService";
import { UsageLimitError } from "./usageLimitService";

const testNow = new Date("2026-07-08T00:00:00.000Z");
const testUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Friend",
  level: "beginner",
};

const correctionOutput: CorrectionAIOutput = {
  correctedText: "저는 학교에서 공부했어요.",
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

function createFakeRepository(): CorrectionRepository & {
  recordInput: CreateCorrectionRecordInput | null;
} {
  const repository: CorrectionRepository & {
    recordInput: CreateCorrectionRecordInput | null;
  } = {
    recordInput: null,
    async createCorrectionRecord(input) {
      repository.recordInput = input;
      return {
        correctionId: "22222222-2222-4222-8222-222222222222",
      };
    },
  };

  return repository;
}

function createFakeAIProvider(output: unknown): AIProvider {
  return {
    async correctKorean() {
      return output as CorrectionAIOutput;
    },
    async extractKoreanTextFromImage() {
      return { extractedText: "" };
    },
    async generateQuizDrafts() {
      return { questions: [] };
    },
  };
}

describe("correctionService", () => {
  it("stops before the AI call when the daily correction limit is reached", async () => {
    const aiProvider = createFakeAIProvider(correctionOutput);
    const correctKorean = vi.spyOn(aiProvider, "correctKorean");
    const service = createCorrectionService(
      createFakeRepository(),
      aiProvider,
      {
        now: () => testNow,
        usageLimiter: {
          consume: vi.fn().mockRejectedValue(new UsageLimitError("correction")),
        },
      },
    );

    await expect(
      service.correctKorean(testUser, {
        text: "저는 학교에 공부했어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).rejects.toMatchObject({ code: "daily_limit_reached" });
    expect(correctKorean).not.toHaveBeenCalled();
  });

  it("corrects Korean text, stores the result, and returns unique recommended tags", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider(correctionOutput),
      {
        now: () => testNow,
      },
    );

    const result = await service.correctKorean(testUser, {
      text: "저는 학교에 공부했어요.",
      inputType: "text",
      level: "beginner",
      correctionStyle: "minimal",
    });

    expect(result).toEqual({
      correctionId: "22222222-2222-4222-8222-222222222222",
      originalText: "저는 학교에 공부했어요.",
      ...correctionOutput,
      recommendedTags: ["particle_location"],
    });
    expect(repository.recordInput).toMatchObject({
      userId: testUser.id,
      inputType: "text",
      originalText: "저는 학교에 공부했어요.",
      aiOutput: correctionOutput,
      recommendedTags: ["particle_location"],
      now: testNow,
    });
  });

  it("stores only the user-edited text when correction starts from OCR", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider(correctionOutput),
      {
        now: () => testNow,
      },
    );

    const result = await service.correctKorean(testUser, {
      text: "저는 학교에 공부했어요.",
      inputType: "image_ocr",
      level: "beginner",
      correctionStyle: "minimal",
    });

    expect(result.originalText).toBe("저는 학교에 공부했어요.");
    expect(repository.recordInput).toMatchObject({
      userId: testUser.id,
      inputType: "image_ocr",
      originalText: "저는 학교에 공부했어요.",
      aiOutput: correctionOutput,
      recommendedTags: ["particle_location"],
      now: testNow,
    });
  });

  it("preserves original formatting when the model only changes line breaks", async () => {
    const repository = createFakeRepository();
    const originalText =
      "오늘은 서쪽 지방을 중심으로 공기가 무척\n탁하겠습니다.";
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        correctedText: "오늘은 서쪽 지방을 중심으로 공기가 무척 탁하겠습니다.",
        explanationEn:
          "Only the line break in the middle of the sentence was removed.",
        mistakes: [
          {
            tag: "spacing",
            originalPart: "무척\n탁하겠습니다",
            correctedPart: "무척 탁하겠습니다",
            explanationEn: "A line break was changed to a regular space.",
            severity: "minor",
          },
        ],
      }),
      { now: () => testNow },
    );

    const result = await service.correctKorean(testUser, {
      text: originalText,
      inputType: "image_ocr",
      level: "beginner",
      correctionStyle: "minimal",
    });

    expect(result).toMatchObject({
      originalText,
      correctedText: originalText,
      explanationEn: "No corrections were needed.",
      mistakes: [],
      recommendedTags: [],
    });
    expect(repository.recordInput?.aiOutput).toEqual({
      correctedText: originalText,
      explanationEn: "No corrections were needed.",
      mistakes: [],
    });
  });

  it("removes mistakes without a real change or matching text", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        ...correctionOutput,
        mistakes: [
          ...correctionOutput.mistakes,
          {
            tag: "word_choice",
            originalPart: "공부했어요",
            correctedPart: "공부했어요",
            explanationEn: "No actual change.",
            severity: "minor",
          },
          {
            tag: "word_choice",
            originalPart: "없는 원문",
            correctedPart: "학교에서",
            explanationEn: "The original part is hallucinated.",
            severity: "minor",
          },
          {
            tag: "word_choice",
            originalPart: "학교에",
            correctedPart: "없는 교정",
            explanationEn: "The corrected part is hallucinated.",
            severity: "minor",
          },
        ],
      }),
      {
        now: () => testNow,
      },
    );

    const result = await service.correctKorean(testUser, {
      text: "저는 학교에 공부했어요.",
      inputType: "text",
      level: "beginner",
      correctionStyle: "minimal",
    });

    expect(result.mistakes).toEqual(correctionOutput.mistakes);
    expect(result.recommendedTags).toEqual(["particle_location"]);
    expect(repository.recordInput?.aiOutput).toMatchObject({
      mistakes: correctionOutput.mistakes,
    });
  });

  it("rejects a non-Korean correctedText for Korean input", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        ...correctionOutput,
        correctedText: "I studied at 학교.",
      }),
      {
        now: () => testNow,
      },
    );

    await expect(
      service.correctKorean(testUser, {
        text: "저는 학교에 공부했어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).rejects.toBeInstanceOf(CorrectionServiceError);
    expect(repository.recordInput).toBeNull();
  });

  it("allows common Latin abbreviations inside predominantly Korean output", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        ...correctionOutput,
        correctedText: "저는 AI를 학교에서 공부했어요.",
        mistakes: [],
      }),
      {
        now: () => testNow,
      },
    );

    await expect(
      service.correctKorean(testUser, {
        text: "저는 AI를 학교에 공부했어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).resolves.toMatchObject({
      correctedText: "저는 AI를 학교에서 공부했어요.",
    });
  });

  it("allows a multi-letter brand name in a short Korean sentence", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        correctedText: "OpenAI 좋아요.",
        explanationEn: "The short Korean sentence is acceptable as written.",
        mistakes: [],
      }),
      {
        now: () => testNow,
      },
    );

    await expect(
      service.correctKorean(testUser, {
        text: "OpenAI 좋아요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).resolves.toMatchObject({
      correctedText: "OpenAI 좋아요.",
    });
  });

  it("rejects invalid AI correction output before storing", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        correctedText: "저는 학교에서 공부했어요.",
        explanationEn: "Use 에서 for an action location.",
        mistakes: [
          {
            tag: "not_allowed",
            originalPart: "학교에",
            correctedPart: "학교에서",
            explanationEn: "Invalid tag.",
            severity: "major",
          },
        ],
      }),
      {
        now: () => testNow,
      },
    );

    await expect(
      service.correctKorean(testUser, {
        text: "저는 학교에 공부했어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).rejects.toBeInstanceOf(CorrectionServiceError);
    expect(repository.recordInput).toBeNull();
  });
});
