import type { CorrectionResponse } from "@/lib/contracts/correction";

export function buildCorrectionReportMarkdown(
  correction: CorrectionResponse,
): string {
  const mistakes = correction.mistakes.length
    ? correction.mistakes
        .map(
          (mistake) =>
            `- ${mistake.tag}: ${mistake.originalPart} -> ${mistake.correctedPart}. ${mistake.explanationEn}`,
        )
        .join("\n")
    : "- No mistakes found.";

  const tags = correction.recommendedTags.length
    ? correction.recommendedTags.map((tag) => `- ${tag}`).join("\n")
    : "- None";

  return [
    "# Korean Correction Report",
    "",
    "## Original",
    "",
    correction.originalText,
    "",
    "## Corrected",
    "",
    correction.correctedText,
    "",
    "## More Natural",
    "",
    correction.naturalText,
    "",
    "## Explanation",
    "",
    correction.explanationEn,
    "",
    "## Mistakes",
    "",
    mistakes,
    "",
    "## Recommended Practice Tags",
    "",
    tags,
    "",
  ].join("\n");
}
