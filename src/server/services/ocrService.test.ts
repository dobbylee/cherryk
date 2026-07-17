import sharp from "sharp";
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
    const imageBytes = await createTestImage(4096, 2048, "jpeg");
    const image = new File([toArrayBuffer(imageBytes)], "note.jpg", {
      type: "image/png",
    });
    let sentImage: { imageBase64: string; imageMimeType: string } | undefined;
    const service = createOCRService(
      createFakeAIProvider(
        {
          extractedText: "저는 학교에 공부했어요.",
          note: "Mock OCR output for local development.",
        },
        (input) => {
          sentImage = input;
        },
      ),
    );

    await expect(service.extractKoreanTextFromImage(image)).resolves.toEqual({
      extractedText: "저는 학교에 공부했어요.",
      note: "Mock OCR output for local development.",
    });

    expect(sentImage?.imageMimeType).toBe("image/jpeg");
    const normalizedMetadata = await sharp(
      Buffer.from(sentImage?.imageBase64 ?? "", "base64"),
    ).metadata();
    expect(normalizedMetadata).toMatchObject({
      width: 2048,
      height: 1024,
      format: "jpeg",
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
    const corruptJpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff])],
      "corrupt.jpg",
      { type: "image/jpeg" },
    );

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
    await expect(
      service.extractKoreanTextFromImage(corruptJpeg),
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
    const imageBytes = await createTestImage(32, 32, "jpeg");
    const image = new File([toArrayBuffer(imageBytes)], "note.jpg", {
      type: "image/png",
    });
    const service = createOCRService(createFakeAIProvider({ note: "missing" }));

    await expect(
      service.extractKoreanTextFromImage(image),
    ).rejects.toBeInstanceOf(OCRServiceError);
  });

  it("replaces Korean OCR notes with an English review message", async () => {
    const imageBytes = await createTestImage(32, 32, "png");
    const image = new File([toArrayBuffer(imageBytes)], "note.png", {
      type: "image/png",
    });
    const service = createOCRService(
      createFakeAIProvider({
        extractedText: "저는 학교에 공부했어요.",
        note: "일부 글자를 정확히 알아볼 수 없습니다.",
      }),
    );

    await expect(service.extractKoreanTextFromImage(image)).resolves.toEqual({
      extractedText: "저는 학교에 공부했어요.",
      note: "Some characters could not be read with confidence. Please review and edit the extracted text.",
    });
  });

  it("uses an English manual-entry message when no text is readable", async () => {
    const imageBytes = await createTestImage(32, 32, "png");
    const image = new File([toArrayBuffer(imageBytes)], "note.png", {
      type: "image/png",
    });
    const service = createOCRService(
      createFakeAIProvider({
        extractedText: "",
        note: "이미지에서 읽을 수 있는 한국어를 찾지 못했습니다.",
      }),
    );

    await expect(service.extractKoreanTextFromImage(image)).resolves.toEqual({
      extractedText: "",
      note: "No readable Korean text was found. Please try another image or enter the text manually.",
    });
  });

  it("adds an English manual-entry message when empty OCR has no usable note", async () => {
    const imageBytes = await createTestImage(32, 32, "png");
    const image = new File([toArrayBuffer(imageBytes)], "note.png", {
      type: "image/png",
    });

    for (const note of [undefined, "   "]) {
      const service = createOCRService(
        createFakeAIProvider({ extractedText: "", note }),
      );

      await expect(service.extractKoreanTextFromImage(image)).resolves.toEqual({
        extractedText: "",
        note: "No readable Korean text was found. Please try another image or enter the text manually.",
      });
    }
  });

  it("preserves detailed English transcription commentary", async () => {
    const imageBytes = await createTestImage(32, 32, "png");
    const image = new File([toArrayBuffer(imageBytes)], "note.png", {
      type: "image/png",
    });
    const note =
      'The word transcribed as "유연하기도" is unusual in context but appears to be written that way.';
    const service = createOCRService(
      createFakeAIProvider({
        extractedText: "유연하기도",
        note,
      }),
    );

    await expect(service.extractKoreanTextFromImage(image)).resolves.toEqual({
      extractedText: "유연하기도",
      note,
    });
  });
});

function createTestImage(
  width: number,
  height: number,
  format: "jpeg" | "png" | "webp",
) {
  const image = sharp({
    create: {
      width,
      height,
      channels: 3,
      background: "white",
    },
  });

  return image[format]().toBuffer();
}

function toArrayBuffer(bytes: Buffer) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}
