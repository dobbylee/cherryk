import type {
  AdminQuizUpdateRequest,
  QuizDraftInput,
} from "@/lib/contracts/quiz";
import {
  AdminQuizDeleteResponseSchema,
  AdminQuizDraftGenerationResponseSchema,
  AdminQuizTagCountsResponseSchema,
  AdminQuizUpdateResponseSchema,
} from "@/lib/contracts/quiz";
import { fetchJson } from "./client";

export function getAdminQuizTagCounts() {
  return fetchJson(
    "/api/v1/admin/quizzes/tag-counts",
    AdminQuizTagCountsResponseSchema,
  );
}

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
