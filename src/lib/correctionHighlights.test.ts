import { describe, expect, it } from "vitest";
import { buildCorrectionHighlightSegments } from "./correctionHighlights";

describe("buildCorrectionHighlightSegments", () => {
  it("highlights corrected parts while preserving the full text", () => {
    const result = buildCorrectionHighlightSegments(
      "대기 질 상황은 무척 탁할 것입니다.",
      "대기질 상황은 무척 탁하겠습니다.",
      [
        { originalPart: "대기 질", correctedPart: "대기질" },
        { originalPart: "탁할 것입니다", correctedPart: "탁하겠습니다" },
      ],
    );

    expect(result).toEqual([
      { text: "대기질", highlighted: true },
      { text: " 상황은 무척 ", highlighted: false },
      { text: "탁하겠습니다", highlighted: true },
      { text: ".", highlighted: false },
    ]);
    expect(result.map((segment) => segment.text).join("")).toBe(
      "대기질 상황은 무척 탁하겠습니다.",
    );
  });

  it("highlights only the aligned occurrence when corrected text repeats", () => {
    expect(
      buildCorrectionHighlightSegments("학교에 학교에서", "학교에서 학교에서", [
        { originalPart: "학교에", correctedPart: "학교에서" },
      ]),
    ).toEqual([
      { text: "학교에서", highlighted: true },
      { text: " 학교에서", highlighted: false },
    ]);
  });

  it("highlights the changed repeated phrase when an unchanged match comes first", () => {
    expect(
      buildCorrectionHighlightSegments("학교에서 학교에", "학교에서 학교에서", [
        { originalPart: "학교에", correctedPart: "학교에서" },
      ]),
    ).toEqual([
      { text: "학교에서 ", highlighted: false },
      { text: "학교에서", highlighted: true },
    ]);
  });

  it("merges overlapping ranges from aligned changes", () => {
    expect(
      buildCorrectionHighlightSegments("학교에", "학교에서", [
        { originalPart: "학교에", correctedPart: "학교에서" },
        { originalPart: "에", correctedPart: "에서" },
      ]),
    ).toEqual([{ text: "학교에서", highlighted: true }]);
  });

  it("highlights the inserted repeated token instead of an unchanged match", () => {
    expect(
      buildCorrectionHighlightSegments(
        "학교에 가요. 집 가요.",
        "학교에 가요. 집에 가요.",
        [{ originalPart: "", correctedPart: "에" }],
      ),
    ).toEqual([
      { text: "학교에 가요. 집", highlighted: false },
      { text: "에", highlighted: true },
      { text: " 가요.", highlighted: false },
    ]);
  });

  it("returns unhighlighted text when corrected parts are empty or missing", () => {
    expect(
      buildCorrectionHighlightSegments("그대로예요.", "그대로예요.", [
        { originalPart: "", correctedPart: "" },
        { originalPart: "없는 원문", correctedPart: "없는 표현" },
      ]),
    ).toEqual([{ text: "그대로예요.", highlighted: false }]);
  });
});
