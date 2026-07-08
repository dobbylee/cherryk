import type { OCRExtractResponse } from "@/lib/contracts/ocr";
import { fetchJson } from "./client";

export function extractKoreanTextFromImage(image: File) {
  const body = new FormData();
  body.set("image", image);

  return fetchJson<OCRExtractResponse>("/api/v1/ocr/extract", {
    method: "POST",
    body,
  });
}
