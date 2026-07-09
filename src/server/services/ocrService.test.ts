import { describe, expect, it } from "vitest";
import type { AIProvider } from "@/server/ai/provider";
import {
  createOCRService,
  MAX_OCR_IMAGE_BYTES,
  OCRServiceError,
  type OCRImageFile,
} from "./ocrService";

function createFakeAIProvider(
  output: unknown,
  onExtract?: (input: { imageBase64: string; imageMimeType: string }) => void,
): AIProvider {
  return {
    async correctKorean() {
      throw new Error("Not used.");
    },
    async extractKoreanTextFromImage(input) {
      onExtract?.(input);
      return output as Awaited<
        ReturnType<AIProvider["extractKoreanTextFromImage"]>
      >;
    },
    async generateQuizDrafts() {
      throw new Error("Not used.");
    },
  };
}

describe("ocrService", () => {
  it("extracts Korean text from an image without storing the original file", async () => {
    const image = new File([new Uint8Array([0xff, 0xd8, 0xff])], "note.jpg", {
      type: "image/png",
    });
    const service = createOCRService(
      createFakeAIProvider(
        {
          extractedText: "저는 학교에 공부했어요.",
          note: "Mock OCR output for local development.",
        },
        (input) => {
          expect(input.imageBase64).toBe("/9j/");
          expect(input.imageMimeType).toBe("image/jpeg");
        },
      ),
    );

    await expect(service.extractKoreanTextFromImage(image)).resolves.toEqual({
      extractedText: "저는 학교에 공부했어요.",
      note: "Mock OCR output for local development.",
    });
  });

  it("rejects missing, oversized, and non-image uploads before OCR", async () => {
    const service = createOCRService(
      createFakeAIProvider({ extractedText: "unused" }),
    );
    const emptyImage = new File([], "empty.png", { type: "image/png" });
    const oversizedImage: OCRImageFile = {
      size: MAX_OCR_IMAGE_BYTES + 1,
      type: "image/png",
      async arrayBuffer() {
        throw new Error("Should not read oversized files.");
      },
    };
    const textFile = new File(["not an image"], "note.txt", {
      type: "text/plain",
    });
    const spoofedImage = new File(["not an image"], "note.png", {
      type: "image/png",
    });

    await expect(
      service.extractKoreanTextFromImage(emptyImage),
    ).rejects.toMatchObject({ code: "invalid_image" });
    await expect(
      service.extractKoreanTextFromImage(oversizedImage),
    ).rejects.toMatchObject({ code: "invalid_image" });
    await expect(
      service.extractKoreanTextFromImage(textFile),
    ).rejects.toMatchObject({ code: "invalid_image" });
    await expect(
      service.extractKoreanTextFromImage(spoofedImage),
    ).rejects.toMatchObject({ code: "invalid_image" });
  });

  it("rejects formats that cannot be sent directly to OpenAI vision", async () => {
    const service = createOCRService(
      createFakeAIProvider({ extractedText: "unused" }, () => {
        throw new Error("Should not call AI for unsupported image formats.");
      }),
    );
    const gifImage = new File(["GIF89a"], "note.gif", {
      type: "image/gif",
    });
    const heicImage = new File(
      [
        new Uint8Array([
          0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69,
          0x63,
        ]),
      ],
      "note.heic",
      { type: "image/heic" },
    );
    const avifImage = new File(
      [
        new Uint8Array([
          0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69,
          0x66,
        ]),
      ],
      "note.avif",
      { type: "image/avif" },
    );

    await expect(
      service.extractKoreanTextFromImage(gifImage),
    ).rejects.toMatchObject({ code: "invalid_image" });
    await expect(
      service.extractKoreanTextFromImage(heicImage),
    ).rejects.toMatchObject({ code: "invalid_image" });
    await expect(
      service.extractKoreanTextFromImage(avifImage),
    ).rejects.toMatchObject({ code: "invalid_image" });
  });

  it("rejects invalid AI OCR output", async () => {
    const image = new File([new Uint8Array([0xff, 0xd8, 0xff])], "note.jpg", {
      type: "image/png",
    });
    const service = createOCRService(createFakeAIProvider({ note: "missing" }));

    await expect(
      service.extractKoreanTextFromImage(image),
    ).rejects.toBeInstanceOf(OCRServiceError);
  });
});
