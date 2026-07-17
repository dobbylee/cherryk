export type CorrectionHighlightSegment = {
  text: string;
  highlighted: boolean;
};

export type CorrectionHighlightChange = {
  originalPart: string;
  correctedPart: string;
};

export function buildCorrectionHighlightSegments(
  originalText: string,
  correctedText: string,
  changes: CorrectionHighlightChange[],
): CorrectionHighlightSegment[] {
  const usedCorrectedRanges = new Set<string>();
  const ranges = changes
    .map((change) =>
      findAlignedCorrectedRange(
        originalText,
        correctedText,
        change,
        usedCorrectedRanges,
      ),
    )
    .filter((range): range is { start: number; end: number } => range !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  if (ranges.length === 0) {
    return [{ text: correctedText, highlighted: false }];
  }

  const mergedRanges = ranges.reduce<{ start: number; end: number }[]>(
    (merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
        return merged;
      }

      merged.push({ ...range });
      return merged;
    },
    [],
  );
  const segments: CorrectionHighlightSegment[] = [];
  let cursor = 0;

  for (const range of mergedRanges) {
    if (cursor < range.start) {
      segments.push({
        text: correctedText.slice(cursor, range.start),
        highlighted: false,
      });
    }
    segments.push({
      text: correctedText.slice(range.start, range.end),
      highlighted: true,
    });
    cursor = range.end;
  }

  if (cursor < correctedText.length) {
    segments.push({
      text: correctedText.slice(cursor),
      highlighted: false,
    });
  }

  return segments;
}

function findAlignedCorrectedRange(
  originalText: string,
  correctedText: string,
  change: CorrectionHighlightChange,
  usedCorrectedRanges: Set<string>,
) {
  if (change.correctedPart.length === 0) {
    return null;
  }

  const correctedRanges = findAllRanges(
    correctedText,
    change.correctedPart,
  ).filter((range) => !usedCorrectedRanges.has(rangeKey(range)));

  if (correctedRanges.length === 0) {
    return null;
  }

  if (change.originalPart.length === 0) {
    const insertionRange = correctedRanges.reduce((best, candidate) => {
      const candidateScore = insertionDifferenceScore(
        originalText,
        correctedText,
        candidate,
      );
      const bestScore = insertionDifferenceScore(
        originalText,
        correctedText,
        best,
      );

      return candidateScore < bestScore ? candidate : best;
    });
    usedCorrectedRanges.add(rangeKey(insertionRange));
    return insertionRange;
  }

  const originalRanges = findAllRanges(originalText, change.originalPart);

  const alignedRange = correctedRanges.reduce((best, candidate) => {
    const candidateScore = bestContextScore(
      originalText,
      correctedText,
      originalRanges,
      candidate,
    );
    const bestScore = bestContextScore(
      originalText,
      correctedText,
      originalRanges,
      best,
    );

    if (candidateScore !== bestScore) {
      return candidateScore > bestScore ? candidate : best;
    }

    const candidateDistance = nearestDistance(candidate, originalRanges);
    const bestDistance = nearestDistance(best, originalRanges);
    return candidateDistance < bestDistance ? candidate : best;
  });
  usedCorrectedRanges.add(rangeKey(alignedRange));
  return alignedRange;
}

function insertionDifferenceScore(
  originalText: string,
  correctedText: string,
  insertedRange: { start: number; end: number },
) {
  const withoutCandidate =
    correctedText.slice(0, insertedRange.start) +
    correctedText.slice(insertedRange.end);

  return differenceSpanLength(originalText, withoutCandidate);
}

function differenceSpanLength(left: string, right: string) {
  const prefixLength = commonPrefixLength(left, right);
  const suffixLimit = Math.min(left.length, right.length) - prefixLength;
  let suffixLength = 0;

  while (
    suffixLength < suffixLimit &&
    left[left.length - suffixLength - 1] ===
      right[right.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return left.length + right.length - 2 * (prefixLength + suffixLength);
}

function bestContextScore(
  originalText: string,
  correctedText: string,
  originalRanges: { start: number; end: number }[],
  correctedRange: { start: number; end: number },
) {
  return Math.max(
    ...originalRanges.map(
      (originalRange) =>
        commonSuffixLength(
          originalText.slice(0, originalRange.start),
          correctedText.slice(0, correctedRange.start),
        ) +
        commonPrefixLength(
          originalText.slice(originalRange.end),
          correctedText.slice(correctedRange.end),
        ),
    ),
  );
}

function nearestDistance(
  correctedRange: { start: number; end: number },
  originalRanges: { start: number; end: number }[],
) {
  return Math.min(
    ...originalRanges.map((range) =>
      Math.abs(range.start - correctedRange.start),
    ),
  );
}

function commonPrefixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let length = 0;

  while (length < limit && left[length] === right[length]) {
    length += 1;
  }

  return length;
}

function commonSuffixLength(left: string, right: string) {
  const limit = Math.min(left.length, right.length);
  let length = 0;

  while (
    length < limit &&
    left[left.length - length - 1] === right[right.length - length - 1]
  ) {
    length += 1;
  }

  return length;
}

function rangeKey(range: { start: number; end: number }) {
  return `${range.start}:${range.end}`;
}

function findAllRanges(text: string, part: string) {
  const ranges: { start: number; end: number }[] = [];
  let startAt = 0;

  while (startAt <= text.length - part.length) {
    const start = text.indexOf(part, startAt);
    if (start === -1) {
      break;
    }
    ranges.push({ start, end: start + part.length });
    startAt = start + part.length;
  }

  return ranges;
}
