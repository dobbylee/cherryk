import { OCRExtractResponseSchema } from "@/lib/contracts/ocr";
import { fetchJson } from "./client";

export function extractKoreanTextFromImage(image: File) {
  const body = new FormData();
  body.set("image", image);

  return fetchJson("/api/v1/ocr/extract", OCRExtractResponseSchema, {
    method: "POST",
    body,
  });
}
