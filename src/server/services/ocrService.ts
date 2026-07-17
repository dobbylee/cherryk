import { Buffer } from "node:buffer";
import {
  OCRAIOutputSchema,
  type OCRExtractResponse,
} from "@/lib/contracts/ocr";
import type { AIProvider } from "@/server/ai/provider";
import {
  normalizeOCRImage,
  type SupportedOCRImageMimeType,
} from "@/server/services/ocrImageNormalizer";

export const OCR_IMAGE_FIELD_NAME = "image";
export const MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024;
const OCR_REVIEW_NOTE =
  "Some characters could not be read with confidence. Please review and edit the extracted text.";
const OCR_NO_TEXT_NOTE =
  "No readable Korean text was found. Please try another image or enter the text manually.";

export type OCRImageFile = {
  arrayBuffer(): Promise<ArrayBuffer>;
  size: number;
  type: string;
};

export class OCRServiceError extends Error {
  constructor(
    readonly code: "invalid_image" | "invalid_ai_output",
    message: string,
  ) {
    super(message);
    this.name = "OCRServiceError";
  }
}

export function createOCRService(aiProvider: AIProvider) {
  return {
    async extractKoreanTextFromImage(
      image: OCRImageFile,
    ): Promise<OCRExtractResponse> {
      validateImage(image);
      const imageBytes = await image.arrayBuffer();
      const imageMimeType = getSupportedImageMimeType(
        new Uint8Array(imageBytes),
      );
      if (!imageMimeType) {
        throw new OCRServiceError(
          "invalid_image",
          "Upload a valid JPEG, PNG, or WebP image.",
        );
      }

      let normalizedImage: Awaited<ReturnType<typeof normalizeOCRImage>>;
      try {
        normalizedImage = await normalizeOCRImage({
          imageBytes: new Uint8Array(imageBytes),
          imageMimeType,
        });
      } catch {
        throw new OCRServiceError(
          "invalid_image",
          "Image could not be processed.",
        );
      }

      const imageBase64 = Buffer.from(normalizedImage.imageBytes).toString(
        "base64",
      );
      const aiResult = await aiProvider.extractKoreanTextFromImage({
        imageBase64,
        imageMimeType: normalizedImage.imageMimeType,
      });
      const parsed = OCRAIOutputSchema.safeParse(aiResult);

      if (!parsed.success) {
        throw new OCRServiceError(
          "invalid_ai_output",
          "AI OCR output is invalid.",
        );
      }

      return normalizeOCRResult(parsed.data);
    },
  };
}

function normalizeOCRResult(result: OCRExtractResponse): OCRExtractResponse {
  const note = result.note?.trim();
  if (!note) {
    return {
      extractedText: result.extractedText,
      ...(result.extractedText.trim() ? {} : { note: OCR_NO_TEXT_NOTE }),
    };
  }

  if (!isPredominantlyKorean(note)) {
    return { extractedText: result.extractedText, note };
  }

  return {
    extractedText: result.extractedText,
    note: result.extractedText.trim() ? OCR_REVIEW_NOTE : OCR_NO_TEXT_NOTE,
  };
}

function isPredominantlyKorean(value: string) {
  let hangulCount = 0;
  let latinCount = 0;

  for (const character of value) {
    if (/[ㄱ-ㅎㅏ-ㅣ가-힣]/u.test(character)) {
      hangulCount += 1;
    } else if (/[A-Za-z]/u.test(character)) {
      latinCount += 1;
    }
  }

  return hangulCount > 0 && hangulCount >= latinCount;
}

function validateImage(image: OCRImageFile) {
  if (image.size <= 0) {
    throw new OCRServiceError("invalid_image", "Image file is required.");
  }

  if (image.size > MAX_OCR_IMAGE_BYTES) {
    throw new OCRServiceError(
      "invalid_image",
      "Image must be 5 MB or smaller.",
    );
  }

  if (image.type && !image.type.startsWith("image/")) {
    throw new OCRServiceError("invalid_image", "Upload an image file.");
  }
}

function getSupportedImageMimeType(
  bytes: Uint8Array,
): SupportedOCRImageMimeType | null {
  if (hasPrefix(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  if (isWebP(bytes)) {
    return "image/webp";
  }

  return null;
}

function isWebP(bytes: Uint8Array) {
  return (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}
