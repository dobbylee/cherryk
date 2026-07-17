import { describe, expect, it, vi } from "vitest";
import { createOpenAIProvider, OpenAIProviderError } from "./openaiProvider";

function createResponse(output: unknown) {
  return Response.json({
    output: [
      {
        type: "message",
        content: [
          {
            type: "output_text",
            text: JSON.stringify(output),
          },
        ],
      },
    ],
  });
}

describe("openAIProvider", () => {
  it("requests structured Korean correction output from the Responses API", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      createResponse({
        correctedText: "저는 학교에서 공부했어요.",
        explanationEn: "Use 에서 for the place where an action happens.",
        mistakes: [
          {
            tag: "particle_location",
            originalPart: "학교에",
            correctedPart: "학교에서",
            explanationEn: "공부하다 happens at 학교, so use 에서.",
            severity: "major",
          },
        ],
      }),
    );
    const provider = createOpenAIProvider({
      apiKey: "test-key",
      textModel: "test-text-model",
      visionModel: "test-vision-model",
      reasoningEffort: "medium",
      fetch: fetchMock as unknown as typeof fetch,
    });

    const correctionInput = {
      text: "저는 학교에 공부했어요.",
      inputType: "image_ocr",
      extractedText: "이전 OCR 전체 텍스트",
      level: "beginner",
      correctionStyle: "minimal",
    } as const;

    await expect(provider.correctKorean(correctionInput)).resolves.toEqual({
      correctedText: "저는 학교에서 공부했어요.",
      explanationEn: "Use 에서 for the place where an action happens.",
      mistakes: [
        {
          tag: "particle_location",
          originalPart: "학교에",
          correctedPart: "학교에서",
          explanationEn: "공부하다 happens at 학교, so use 에서.",
          severity: "major",
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    const body = JSON.parse(String(init?.body));
    expect(headers.get("Authorization")).toBe("Bearer test-key");
    expect(body.model).toBe("test-text-model");
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(body.store).toBe(false);
    expect(JSON.parse(body.input)).toEqual({
      text: "저는 학교에 공부했어요.",
      level: "beginner",
      correctionStyle: "minimal",
    });
    expect(body.text.format).toMatchObject({
      type: "json_schema",
      name: "korean_correction",
      strict: true,
    });
    expect(body.input).toContain("학교에 공부했어요");
    expect(body.instructions).toContain("correctedText must be Korean");
    expect(body.instructions).toContain(
      "Do not treat layout-only line-break changes as mistakes",
    );
    expect(body.text.format.schema.required).not.toContain("naturalText");
    expect(body.text.format.schema.properties).not.toHaveProperty(
      "naturalText",
    );
    expect(body.instructions).toContain(
      "originalPart and correctedPart must differ",
    );
  });

  it("sends OCR images as data URLs and normalizes null notes", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      createResponse({
        extractedText: "저는 학교에 공부했어요.",
        note: null,
      }),
    );
    const provider = createOpenAIProvider({
      apiKey: "test-key",
      textModel: "test-text-model",
      visionModel: "test-vision-model",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      provider.extractKoreanTextFromImage({
        imageBase64: "aW1hZ2U=",
        imageMimeType: "image/png",
      }),
    ).resolves.toEqual({
      extractedText: "저는 학교에 공부했어요.",
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("test-vision-model");
    expect(body.input[0].content[1]).toEqual({
      type: "input_image",
      detail: "original",
      image_url: "data:image/png;base64,aW1hZ2U=",
    });
    expect(body.text.format.name).toBe("korean_ocr");
    expect(body.instructions).toContain("always write note in English");
    expect(body.instructions).toContain("return an empty extractedText");
  });

  it("requests quiz draft structured output", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      createResponse({
        questions: [
          {
            tag: "particle_object",
            difficulty: "beginner",
            questionEn: "Choose the correct particle.",
            sentenceKo: "저는 사과( ) 먹어요.",
            choices: [
              { text: "은", isCorrect: false },
              { text: "를", isCorrect: true },
              { text: "에", isCorrect: false },
              { text: "이", isCorrect: false },
            ],
            answerExplanationEn:
              "Use 를 because 사과 is the direct object of 먹어요.",
          },
        ],
      }),
    );
    const provider = createOpenAIProvider({
      apiKey: "test-key",
      textModel: "test-text-model",
      visionModel: "test-vision-model",
      fetch: fetchMock as unknown as typeof fetch,
    });

    await expect(
      provider.generateQuizDrafts({
        tag: "particle_object",
        difficulty: "beginner",
        count: 1,
      }),
    ).resolves.toMatchObject({
      questions: [
        {
          tag: "particle_object",
          difficulty: "beginner",
        },
      ],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(init?.body));
    expect(body.model).toBe("test-text-model");
    expect(body.text.format.name).toBe("quiz_drafts");
  });

  it("throws a typed error when OpenAI returns an API error", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async () => new Response("{}", { status: 500 }),
    );
    const provider = createOpenAIProvider({
      apiKey: "test-key",
      textModel: "test-text-model",
      visionModel: "test-vision-model",
      fetch: fetchMock,
    });

    await expect(
      provider.correctKorean({
        text: "저는 학교에 공부했어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).rejects.toBeInstanceOf(OpenAIProviderError);
  });

  it("requires a model before making a request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const provider = createOpenAIProvider({
      apiKey: "test-key",
      fetch: fetchMock,
    });

    await expect(
      provider.correctKorean({
        text: "저는 학교에 공부했어요.",
        inputType: "text",
        level: "beginner",
        correctionStyle: "minimal",
      }),
    ).rejects.toMatchObject({
      code: "not_configured",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
