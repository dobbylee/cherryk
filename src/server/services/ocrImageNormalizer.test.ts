import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  MAX_OCR_IMAGE_DIMENSION,
  normalizeOCRImage,
} from "./ocrImageNormalizer";

describe("normalizeOCRImage", () => {
  it("resizes large images while preserving their format and aspect ratio", async () => {
    const imageBytes = await createImage(4096, 2048, "png");

    const normalized = await normalizeOCRImage({
      imageBytes,
      imageMimeType: "image/png",
    });

    expect(normalized.imageMimeType).toBe("image/png");
    await expect(sharp(normalized.imageBytes).metadata()).resolves.toMatchObject({
      width: MAX_OCR_IMAGE_DIMENSION,
      height: MAX_OCR_IMAGE_DIMENSION / 2,
      format: "png",
    });
  });

  it("does not enlarge small images and strips orientation metadata", async () => {
    const imageBytes = await sharp({
      create: {
        width: 1200,
        height: 800,
        channels: 3,
        background: "white",
      },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const normalized = await normalizeOCRImage({
      imageBytes,
      imageMimeType: "image/jpeg",
    });
    const metadata = await sharp(normalized.imageBytes).metadata();

    expect(metadata).toMatchObject({
      width: 800,
      height: 1200,
      format: "jpeg",
    });
    expect(metadata.orientation).toBeUndefined();
  });

  it("rejects corrupt images", async () => {
    await expect(
      normalizeOCRImage({
        imageBytes: new Uint8Array([0xff, 0xd8, 0xff]),
        imageMimeType: "image/jpeg",
      }),
    ).rejects.toThrow();
  });
});

function createImage(
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
