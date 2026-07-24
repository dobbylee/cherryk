import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/api-v1.json";
import { MeResponseSchema } from "./auth";
import { ApiErrorSchema } from "./common";
import { CorrectionInputSchema, CorrectionResponseSchema } from "./correction";
import { OCRExtractResponseSchema } from "./ocr";
import {
  AdminQuizDeleteResponseSchema,
  AdminQuizDraftGenerationResponseSchema,
  AdminQuizUpdateRequestSchema,
  AdminQuizUpdateResponseSchema,
  QuizAttemptRequestSchema,
  QuizAttemptResponseSchema,
  QuizDraftInputSchema,
  QuizRecommendationQuerySchema,
  QuizRecommendationResponseSchema,
} from "./quiz";

describe("Spring migration API fixtures", () => {
  it("remain valid examples of every public v1 contract", () => {
    expect(fixtures.version).toBe(1);
    expect(ApiErrorSchema.parse(fixtures.apiError)).toEqual(fixtures.apiError);
    expect(MeResponseSchema.parse(fixtures.meResponse)).toEqual(
      fixtures.meResponse,
    );
    expect(CorrectionInputSchema.parse(fixtures.correctionRequest)).toEqual(
      fixtures.correctionRequest,
    );
    expect(CorrectionResponseSchema.parse(fixtures.correctionResponse)).toEqual(
      fixtures.correctionResponse,
    );
    expect(OCRExtractResponseSchema.parse(fixtures.ocrResponse)).toEqual(
      fixtures.ocrResponse,
    );
    expect(
      QuizRecommendationQuerySchema.parse(fixtures.quizRecommendationQuery),
    ).toEqual(fixtures.quizRecommendationQuery);
    expect(
      QuizRecommendationResponseSchema.parse(
        fixtures.quizRecommendationResponse,
      ),
    ).toEqual(fixtures.quizRecommendationResponse);
    expect(QuizAttemptRequestSchema.parse(fixtures.quizAttemptRequest)).toEqual(
      fixtures.quizAttemptRequest,
    );
    expect(
      QuizAttemptResponseSchema.parse(fixtures.quizAttemptResponse),
    ).toEqual(fixtures.quizAttemptResponse);
    expect(QuizDraftInputSchema.parse(fixtures.adminQuizDraftRequest)).toEqual(
      fixtures.adminQuizDraftRequest,
    );
    expect(
      AdminQuizDraftGenerationResponseSchema.parse(
        fixtures.adminQuizDraftResponse,
      ),
    ).toEqual(fixtures.adminQuizDraftResponse);
    expect(
      AdminQuizUpdateRequestSchema.parse(fixtures.adminQuizUpdateRequest),
    ).toEqual(fixtures.adminQuizUpdateRequest);
    expect(
      AdminQuizUpdateResponseSchema.parse(fixtures.adminQuizUpdateResponse),
    ).toEqual(fixtures.adminQuizUpdateResponse);
    expect(
      AdminQuizDeleteResponseSchema.parse(fixtures.adminQuizDeleteResponse),
    ).toEqual(fixtures.adminQuizDeleteResponse);
  });
});
