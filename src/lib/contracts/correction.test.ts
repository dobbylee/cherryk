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
  it("accepts opaque non-empty string ids after BIGINT migration", () => {
    expect(CorrectionResponseSchema.parse(correctionResponse)).toEqual(
      correctionResponse,
    );
  });

  it("rejects an empty correction id", () => {
    expect(
      CorrectionResponseSchema.safeParse({
        ...correctionResponse,
        correctionId: "",
      }).success,
    ).toBe(false);
  });
});
