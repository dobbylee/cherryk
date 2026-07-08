import { Buffer } from "node:buffer";
import {
  OCRAIOutputSchema,
  type OCRExtractResponse,
} from "@/lib/contracts/ocr";
import type { AIProvider } from "@/server/ai/provider";

export const OCR_IMAGE_FIELD_NAME = "image";
export const MAX_OCR_IMAGE_BYTES = 5 * 1024 * 1024;

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
      validateImageBytes(new Uint8Array(imageBytes));

      const imageBase64 = Buffer.from(imageBytes).toString("base64");
      const aiResult = await aiProvider.extractKoreanTextFromImage({
        imageBase64,
      });
      const parsed = OCRAIOutputSchema.safeParse(aiResult);

      if (!parsed.success) {
        throw new OCRServiceError(
          "invalid_ai_output",
          "AI OCR output is invalid.",
        );
      }

      return parsed.data;
    },
  };
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

function validateImageBytes(bytes: Uint8Array) {
  if (!hasSupportedImageSignature(bytes)) {
    throw new OCRServiceError("invalid_image", "Upload a valid image file.");
  }
}

function hasSupportedImageSignature(bytes: Uint8Array) {
  return (
    hasPrefix(bytes, [0xff, 0xd8, 0xff]) ||
    hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
    hasPrefix(bytes, [0x47, 0x49, 0x46, 0x38]) ||
    isWebP(bytes) ||
    isHeifFamily(bytes)
  );
}

function isWebP(bytes: Uint8Array) {
  return (
    hasPrefix(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

function isHeifFamily(bytes: Uint8Array) {
  if (
    bytes.length < 12 ||
    String.fromCharCode(...bytes.slice(4, 8)) !== "ftyp"
  ) {
    return false;
  }

  return ["avif", "heic", "heix", "hevc", "hevx", "mif1", "msf1"].includes(
    String.fromCharCode(...bytes.slice(8, 12)),
  );
}

function hasPrefix(bytes: Uint8Array, prefix: number[]) {
  return prefix.every((byte, index) => bytes[index] === byte);
}
