import { describe, expect, it } from "vitest";
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

const testNow = new Date("2026-07-08T00:00:00.000Z");
const testUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Friend",
  level: "beginner",
};

const correctionOutput: CorrectionAIOutput = {
  correctedText: "저는 학교에서 공부했어요.",
  naturalText: "저는 학교에서 공부했어요.",
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
    {
      tag: "particle_location",
      originalPart: "집에",
      correctedPart: "집에서",
      explanationEn: "공부하다 happens at 집, so use 에서.",
      severity: "minor",
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

  it("rejects invalid AI correction output before storing", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        correctedText: "저는 학교에서 공부했어요.",
        naturalText: "저는 학교에서 공부했어요.",
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
