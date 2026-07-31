import type {
  AdminQuizUpdateRequest,
  QuizDraftInput,
} from "@/lib/contracts/quiz";
import {
  AdminQuizDeleteResponseSchema,
  AdminQuizDraftGenerationResponseSchema,
  AdminQuizUpdateResponseSchema,
} from "@/lib/contracts/quiz";
import { fetchJson } from "./client";

export function generateAdminQuizDrafts(input: QuizDraftInput) {
  return fetchJson(
    "/api/v1/admin/quizzes/generate-drafts",
    AdminQuizDraftGenerationResponseSchema,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export function updateAdminQuiz(quizId: string, input: AdminQuizUpdateRequest) {
  return fetchJson(
    `/api/v1/admin/quizzes/${quizId}`,
    AdminQuizUpdateResponseSchema,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    },
  );
}

export function deleteAdminQuizDraft(quizId: string) {
  return fetchJson(
    `/api/v1/admin/quizzes/${quizId}`,
    AdminQuizDeleteResponseSchema,
    {
      method: "DELETE",
    },
  );
}
