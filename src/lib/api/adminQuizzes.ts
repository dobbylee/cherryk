import { ADMIN_SECRET_HEADER } from "@/lib/contracts/admin";
import type {
  AdminQuizDraftGenerationResponse,
  AdminQuizUpdateRequest,
  AdminQuizUpdateResponse,
  QuizDraftInput,
} from "@/lib/contracts/quiz";
import { fetchJson } from "./client";

export function generateAdminQuizDrafts(
  adminSecret: string,
  input: QuizDraftInput,
) {
  return fetchJson<AdminQuizDraftGenerationResponse>(
    "/api/v1/admin/quizzes/generate-drafts",
    {
      method: "POST",
      headers: {
        [ADMIN_SECRET_HEADER]: adminSecret,
      },
      body: JSON.stringify(input),
    },
  );
}

export function updateAdminQuiz(
  adminSecret: string,
  quizId: string,
  input: AdminQuizUpdateRequest,
) {
  return fetchJson<AdminQuizUpdateResponse>(
    `/api/v1/admin/quizzes/${quizId}`,
    {
      method: "PATCH",
      headers: {
        [ADMIN_SECRET_HEADER]: adminSecret,
      },
      body: JSON.stringify(input),
    },
  );
}
