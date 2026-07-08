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
  correctedText: "오늘 친구를 만났어요.",
  naturalText: "오늘은 친구를 만났어요.",
  explanationEn: "Use the object particle for the direct object.",
  mistakes: [
    {
      tag: "particle_object",
      originalPart: "친구",
      correctedPart: "친구를",
      explanationEn: "친구 is the direct object of 만나다.",
      severity: "major",
    },
    {
      tag: "particle_object",
      originalPart: "사과",
      correctedPart: "사과를",
      explanationEn: "사과 is the direct object of 먹다.",
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
      text: "오늘 친구 만났어요.",
      inputType: "text",
      level: "beginner",
      correctionStyle: "minimal",
    });

    expect(result).toEqual({
      correctionId: "22222222-2222-4222-8222-222222222222",
      originalText: "오늘 친구 만났어요.",
      ...correctionOutput,
      recommendedTags: ["particle_object"],
    });
    expect(repository.recordInput).toMatchObject({
      userId: testUser.id,
      inputType: "text",
      originalText: "오늘 친구 만났어요.",
      aiOutput: correctionOutput,
      recommendedTags: ["particle_object"],
      now: testNow,
    });
  });

  it("rejects invalid AI correction output before storing", async () => {
    const repository = createFakeRepository();
    const service = createCorrectionService(
      repository,
      createFakeAIProvider({
        correctedText: "오늘 친구를 만났어요.",
        naturalText: "오늘은 친구를 만났어요.",
        explanationEn: "Use the object particle.",
        mistakes: [
          {
            tag: "not_allowed",
            originalPart: "친구",
            correctedPart: "친구를",
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
        text: "오늘 친구 만났어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).rejects.toBeInstanceOf(CorrectionServiceError);
    expect(repository.recordInput).toBeNull();
  });
});
