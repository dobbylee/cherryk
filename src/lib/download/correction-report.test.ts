import { describe, expect, it } from "vitest";
import { buildCorrectionReportMarkdown } from "./correction-report";

describe("buildCorrectionReportMarkdown", () => {
  it("includes correction fields and recommended tags", () => {
    const report = buildCorrectionReportMarkdown({
      correctionId: "00000000-0000-4000-8000-000000000000",
      originalText: "저는 학교에 공부했어요.",
      correctedText: "저는 학교에서 공부했어요.",
      naturalText: "저는 학교에서 공부했어요.",
      explanationEn: "Use 에서 for an action location.",
      mistakes: [
        {
          tag: "particle_location",
          originalPart: "학교에",
          correctedPart: "학교에서",
          explanationEn: "공부하다 happens at 학교.",
          severity: "major",
        },
      ],
      recommendedTags: ["particle_location"],
    });

    expect(report).toContain("저는 학교에서 공부했어요.");
    expect(report).toContain("- particle_location");
  });
});
