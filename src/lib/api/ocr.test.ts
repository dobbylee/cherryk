import { afterEach, describe, expect, it, vi } from "vitest";
import { extractKoreanTextFromImage } from "./ocr";

describe("extractKoreanTextFromImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the selected image as form data", async () => {
    const image = new File(["image"], "note.png", { type: "image/png" });
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        expect(input).toBe("/api/v1/ocr/extract");
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeInstanceOf(FormData);
        expect((init?.body as FormData).get("image")).toBe(image);
        return Response.json({ extractedText: "저는 학교에 공부했어요." });
      },
    );

    vi.stubGlobal("fetch", fetchMock);

    await expect(extractKoreanTextFromImage(image)).resolves.toEqual({
      extractedText: "저는 학교에 공부했어요.",
    });
  });
});
