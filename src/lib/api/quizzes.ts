import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import type { QuizAttemptRequest } from "@/lib/contracts/quiz";
import {
  QuizAttemptResponseSchema,
  QuizRecommendationResponseSchema,
} from "@/lib/contracts/quiz";
import { fetchJson } from "./client";

export function fetchQuizRecommendations(tags?: GrammarTag[]) {
  const query = new URLSearchParams();
  if (tags !== undefined) {
    query.set("tags", tags.join(","));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson(
    `/api/v1/quizzes/recommend${suffix}`,
    QuizRecommendationResponseSchema,
  );
}

export function submitQuizAttempt(input: QuizAttemptRequest) {
  return fetchJson("/api/v1/quizzes/attempt", QuizAttemptResponseSchema, {
    method: "POST",
    body: JSON.stringify(input),
  });
}
