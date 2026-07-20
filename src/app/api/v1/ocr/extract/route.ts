import { NextResponse } from "next/server";
import type { OCRExtractResponse } from "@/lib/contracts/ocr";
import { createAIProvider } from "@/server/ai/configuredProvider";
import {
  AuthenticationError,
  requireCurrentUser,
} from "@/server/auth/currentUser";
import { createDb } from "@/server/db";
import { createUsageRepository } from "@/server/repositories/usageRepository";
import {
  createOCRService,
  OCR_IMAGE_FIELD_NAME,
  OCRServiceError,
} from "@/server/services/ocrService";
import {
  createUsageLimitService,
  UsageLimitError,
} from "@/server/services/usageLimitService";
import { apiError } from "../../_responses";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userResult = await getAuthenticatedUser(request);
  if (userResult instanceof Response) {
    return userResult;
  }

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return apiError("invalid_request", "Request body must be form data.", 400);
  }

  const image = formData.get(OCR_IMAGE_FIELD_NAME);
  if (!isUploadedImage(image)) {
    return apiError("invalid_image", "Image file is required.", 400);
  }

  try {
    const db = createDb();
    const service = createOCRService(createAIProvider(), {
      usageLimiter: createUsageLimitService(createUsageRepository(db)),
      userId: userResult.id,
    });
    const response = await service.extractKoreanTextFromImage(image);

    return NextResponse.json<OCRExtractResponse>(response);
  } catch (error) {
    if (error instanceof OCRServiceError) {
      return apiError(
        error.code,
        error.message,
        error.code === "invalid_ai_output" ? 502 : 400,
      );
    }

    if (error instanceof UsageLimitError) {
      return apiError(error.code, error.message, 429);
    }

    return apiError("server_error", "OCR is unavailable.", 500);
  }
}

async function getAuthenticatedUser(request: Request) {
  try {
    return await requireCurrentUser(request);
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return apiError(error.code, error.message, 401);
    }

    return apiError("server_error", "Authentication is unavailable.", 500);
  }
}

function isUploadedImage(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    typeof value.arrayBuffer === "function" &&
    "size" in value &&
    typeof value.size === "number" &&
    "type" in value &&
    typeof value.type === "string"
  );
}
