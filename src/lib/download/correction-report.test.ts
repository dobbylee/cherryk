import { describe, expect, it } from "vitest";
import { buildCorrectionReportMarkdown } from "./correction-report";

describe("buildCorrectionReportMarkdown", () => {
  it("includes correction fields and recommended tags", () => {
    const report = buildCorrectionReportMarkdown({
      correctionId: "00000000-0000-4000-8000-000000000000",
      originalText: "오늘 친구 만났어요.",
      correctedText: "오늘 친구를 만났어요.",
      naturalText: "오늘은 친구를 만났어요.",
      explanationEn: "Use the object particle.",
      mistakes: [
        {
          tag: "particle_object",
          originalPart: "친구",
          correctedPart: "친구를",
          explanationEn: "The noun is the object of 만나다.",
          severity: "major",
        },
      ],
      recommendedTags: ["particle_object"],
    });

    expect(report).toContain("오늘 친구를 만났어요.");
    expect(report).toContain("- particle_object");
  });
});
