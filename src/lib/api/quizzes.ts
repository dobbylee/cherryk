import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import type {
  QuizAttemptRequest,
  QuizAttemptResponse,
  QuizRecommendationResponse,
} from "@/lib/contracts/quiz";
import { fetchJson } from "./client";

export function fetchQuizRecommendations(tags?: GrammarTag[]) {
  const query = new URLSearchParams();
  if (tags !== undefined) {
    query.set("tags", tags.join(","));
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return fetchJson<QuizRecommendationResponse>(
    `/api/v1/quizzes/recommend${suffix}`,
  );
}

export function submitQuizAttempt(input: QuizAttemptRequest) {
  return fetchJson<QuizAttemptResponse>("/api/v1/quizzes/attempt", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
