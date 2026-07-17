import { UserLevels } from "@/lib/contracts/common";
import type { CorrectionAIOutput } from "@/lib/contracts/correction";
import { GrammarTags } from "@/lib/contracts/grammar-tags";
import type { OCRAIOutput } from "@/lib/contracts/ocr";
import type { QuizDraftOutput } from "@/lib/contracts/quiz";
import type { AIProvider } from "./provider";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

type FetchLike = typeof fetch;

type OpenAIProviderOptions = {
  apiKey?: string;
  textModel?: string;
  visionModel?: string;
  reasoningEffort?: ReasoningEffort;
  fetch?: FetchLike;
};

export const ReasoningEfforts = [
  "none",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

export type ReasoningEffort = (typeof ReasoningEfforts)[number];

export class OpenAIProviderError extends Error {
  constructor(
    readonly code: "not_configured" | "request_failed" | "invalid_response",
    message: string,
  ) {
    super(message);
    this.name = "OpenAIProviderError";
  }
}

export function createOpenAIProvider(
  options: OpenAIProviderOptions = {},
): AIProvider {
  const fetcher = options.fetch ?? fetch;

  return {
    async correctKorean(input) {
      return requestStructuredOutput<CorrectionAIOutput>({
        apiKey: requireValue(options.apiKey, "OPENAI_API_KEY is required."),
        model: requireValue(options.textModel, "AI_TEXT_MODEL is required."),
        reasoningEffort: options.reasoningEffort,
        fetcher,
        schemaName: "korean_correction",
        schema: correctionOutputSchema,
        instructions: correctionInstructions,
        input: JSON.stringify({
          text: input.text,
          level: input.level,
          correctionStyle: input.correctionStyle,
        }),
      });
    },

    async extractKoreanTextFromImage(input) {
      const result = await requestStructuredOutput<{
        extractedText: string;
        note: string | null;
      }>({
        apiKey: requireValue(options.apiKey, "OPENAI_API_KEY is required."),
        model: requireValue(
          options.visionModel,
          "AI_VISION_MODEL is required.",
        ),
        reasoningEffort: options.reasoningEffort,
        fetcher,
        schemaName: "korean_ocr",
        schema: ocrOutputSchema,
        instructions: ocrInstructions,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "Extract the Korean text from this image.",
              },
              {
                type: "input_image",
                detail: "original",
                image_url: `data:${input.imageMimeType};base64,${input.imageBase64}`,
              },
            ],
          },
        ],
      });

      return normalizeOCRResult(result);
    },

    async generateQuizDrafts(input) {
      return requestStructuredOutput<QuizDraftOutput>({
        apiKey: requireValue(options.apiKey, "OPENAI_API_KEY is required."),
        model: requireValue(options.textModel, "AI_TEXT_MODEL is required."),
        reasoningEffort: options.reasoningEffort,
        fetcher,
        schemaName: "quiz_drafts",
        schema: quizDraftOutputSchema,
        instructions: quizDraftInstructions,
        input: JSON.stringify(input),
      });
    },
  };
}

async function requestStructuredOutput<T>(input: {
  apiKey: string;
  model: string;
  reasoningEffort?: ReasoningEffort;
  fetcher: FetchLike;
  instructions: string;
  input: unknown;
  schemaName: string;
  schema: Record<string, unknown>;
}) {
  const response = await input.fetcher(RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      ...(input.reasoningEffort
        ? { reasoning: { effort: input.reasoningEffort } }
        : {}),
      instructions: input.instructions,
      input: input.input,
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: input.schemaName,
          strict: true,
          schema: input.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new OpenAIProviderError(
      "request_failed",
      `OpenAI request failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();
  const outputText = readOutputText(payload);
  if (!outputText) {
    throw new OpenAIProviderError(
      "invalid_response",
      "OpenAI response did not include output text.",
    );
  }

  try {
    return JSON.parse(outputText) as T;
  } catch {
    throw new OpenAIProviderError(
      "invalid_response",
      "OpenAI response output was not valid JSON.",
    );
  }
}

function readOutputText(payload: unknown) {
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("output" in payload)
  ) {
    return null;
  }

  const output = payload.output;
  if (!Array.isArray(output)) {
    return null;
  }

  for (const item of output) {
    if (typeof item !== "object" || item === null || !("content" in item)) {
      continue;
    }

    const content = item.content;
    if (!Array.isArray(content)) {
      continue;
    }

    const textPart = content.find(
      (part) =>
        typeof part === "object" &&
        part !== null &&
        "type" in part &&
        part.type === "output_text" &&
        "text" in part &&
        typeof part.text === "string",
    );

    if (textPart && "text" in textPart && typeof textPart.text === "string") {
      return textPart.text;
    }
  }

  return null;
}

function normalizeOCRResult(input: {
  extractedText: string;
  note: string | null;
}): OCRAIOutput {
  return input.note
    ? { extractedText: input.extractedText, note: input.note }
    : { extractedText: input.extractedText };
}

function requireValue(value: string | undefined, message: string) {
  if (!value) {
    throw new OpenAIProviderError("not_configured", message);
  }

  return value;
}

const correctionInstructions = [
  "You correct Korean learner writing.",
  "Preserve meaning and make the smallest correction that fixes real errors.",
  "Do not over-correct natural casual Korean.",
  "Preserve line breaks and paragraph breaks. Do not treat layout-only line-break changes as mistakes.",
  "correctedText must be Korean and must never be an English translation.",
  "Each mistake must describe a real change: originalPart and correctedPart must differ and must match the relevant source and corrected text exactly.",
  "Return English explanations and tags only from the allowed enum.",
].join("\n");

const ocrInstructions = [
  "Extract Korean text from the image as written.",
  "Do not correct grammar or spelling.",
  "Preserve line breaks where possible.",
  "Use note only when characters are uncertain, and always write note in English.",
  "If no Korean text is readable, return an empty extractedText and explain that in note.",
].join("\n");

const quizDraftInstructions = [
  "Create Korean-learning multiple choice quiz drafts for human review.",
  "Use natural Korean sentences and English explanations.",
  "Each question must have exactly four choices and exactly one correct choice.",
  "Generated questions are drafts and must not assume user-facing approval.",
].join("\n");

const grammarTagProperty = {
  type: "string",
  enum: GrammarTags,
};

const userLevelProperty = {
  type: "string",
  enum: UserLevels,
};

const correctionOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["correctedText", "explanationEn", "mistakes"],
  properties: {
    correctedText: { type: "string" },
    explanationEn: { type: "string" },
    mistakes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "tag",
          "originalPart",
          "correctedPart",
          "explanationEn",
          "severity",
        ],
        properties: {
          tag: grammarTagProperty,
          originalPart: { type: "string" },
          correctedPart: { type: "string" },
          explanationEn: { type: "string" },
          severity: { type: "string", enum: ["minor", "major"] },
        },
      },
    },
  },
};

const ocrOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["extractedText", "note"],
  properties: {
    extractedText: { type: "string" },
    note: { type: ["string", "null"] },
  },
};

const quizChoiceSchema = {
  type: "object",
  additionalProperties: false,
  required: ["text", "isCorrect"],
  properties: {
    text: { type: "string" },
    isCorrect: { type: "boolean" },
  },
};

const quizDraftOutputSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "tag",
          "difficulty",
          "questionEn",
          "sentenceKo",
          "choices",
          "answerExplanationEn",
        ],
        properties: {
          tag: grammarTagProperty,
          difficulty: userLevelProperty,
          questionEn: { type: "string" },
          sentenceKo: { type: "string" },
          choices: {
            type: "array",
            minItems: 4,
            maxItems: 4,
            items: quizChoiceSchema,
          },
          answerExplanationEn: { type: "string" },
        },
      },
    },
  },
};
