export function isValidDraftCount(count: number) {
  return Number.isInteger(count) && count >= 1 && count <= 20;
}
