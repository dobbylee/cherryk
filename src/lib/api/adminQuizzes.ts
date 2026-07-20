import type {
  AdminQuizDeleteResponse,
  AdminQuizDraftGenerationResponse,
  AdminQuizUpdateRequest,
  AdminQuizUpdateResponse,
  QuizDraftInput,
} from "@/lib/contracts/quiz";
import { fetchJson } from "./client";

export function generateAdminQuizDrafts(input: QuizDraftInput) {
  return fetchJson<AdminQuizDraftGenerationResponse>(
    "/api/v1/admin/quizzes/generate-drafts",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateAdminQuiz(quizId: string, input: AdminQuizUpdateRequest) {
  return fetchJson<AdminQuizUpdateResponse>(`/api/v1/admin/quizzes/${quizId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAdminQuizDraft(quizId: string) {
  return fetchJson<AdminQuizDeleteResponse>(`/api/v1/admin/quizzes/${quizId}`, {
    method: "DELETE",
  });
}
