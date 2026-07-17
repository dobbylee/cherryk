import sharp from "sharp";

export const MAX_OCR_IMAGE_DIMENSION = 2048;
const MAX_OCR_INPUT_PIXELS = 64_000_000;

export type SupportedOCRImageMimeType =
  | "image/jpeg"
  | "image/png"
  | "image/webp";

export async function normalizeOCRImage(input: {
  imageBytes: Uint8Array;
  imageMimeType: SupportedOCRImageMimeType;
}) {
  const image = sharp(input.imageBytes, {
    failOn: "error",
    limitInputPixels: MAX_OCR_INPUT_PIXELS,
  })
    .rotate()
    .resize({
      width: MAX_OCR_IMAGE_DIMENSION,
      height: MAX_OCR_IMAGE_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    });

  const normalizedImage = encodeImage(image, input.imageMimeType);
  const { data } = await normalizedImage.toBuffer({ resolveWithObject: true });

  return {
    imageBytes: data,
    imageMimeType: input.imageMimeType,
  };
}

function encodeImage(
  image: sharp.Sharp,
  imageMimeType: SupportedOCRImageMimeType,
) {
  switch (imageMimeType) {
    case "image/jpeg":
      return image.jpeg({ quality: 90, chromaSubsampling: "4:4:4" });
    case "image/png":
      return image.png();
    case "image/webp":
      return image.webp({ quality: 90, smartSubsample: true });
  }
}
