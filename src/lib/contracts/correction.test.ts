import { describe, expect, it } from "vitest";
import { CorrectionResponseSchema } from "./correction";

const correctionResponse = {
  correctionId: "42",
  originalText: "저는 학교에 공부했어요.",
  correctedText: "저는 학교에서 공부했어요.",
  explanationEn: "Use 에서 for the place where an action happens.",
  mistakes: [
    {
      tag: "particle_location",
      originalPart: "학교에",
      correctedPart: "학교에서",
      explanationEn: "The action happens at school.",
      severity: "minor",
    },
  ],
  recommendedTags: ["particle_location"],
};

describe("CorrectionResponseSchema", () => {
  it("accepts positive decimal string ids after BIGINT migration", () => {
    expect(CorrectionResponseSchema.parse(correctionResponse)).toEqual(
      correctionResponse,
    );
  });

  it("rejects non-Spring correction ids", () => {
    expect(
      CorrectionResponseSchema.safeParse({
        ...correctionResponse,
        correctionId: "",
      }).success,
    ).toBe(false);
    expect(
      CorrectionResponseSchema.safeParse({
        ...correctionResponse,
        correctionId: "20000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });
});
