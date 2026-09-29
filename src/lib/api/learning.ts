import { LearningRhythmResponseSchema } from "@/lib/contracts/learning";
import { fetchJson } from "./client";

export function fetchLearningRhythm(timeZone: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ timeZone });
  return fetchJson(
    `/api/v1/learning/rhythm?${query}`,
    LearningRhythmResponseSchema,
    {
      cache: "no-store",
      signal,
    },
  );
}
