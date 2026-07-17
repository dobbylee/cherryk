import { mockAIProvider } from "./mockAIProvider";
import {
  createOpenAIProvider,
  ReasoningEfforts,
  type ReasoningEffort,
} from "./openaiProvider";
import type { AIProvider } from "./provider";

type AIProviderEnv = {
  NODE_ENV?: string;
  OPENAI_API_KEY?: string;
  AI_TEXT_MODEL?: string;
  AI_VISION_MODEL?: string;
  AI_REASONING_EFFORT?: string;
};

export function createAIProvider(env: AIProviderEnv = readAIProviderEnv()): AIProvider {
  if (!env.OPENAI_API_KEY) {
    if (env.NODE_ENV === "production") {
      throw new Error("OPENAI_API_KEY is required in production.");
    }

    return mockAIProvider;
  }

  return createOpenAIProvider({
    apiKey: env.OPENAI_API_KEY,
    textModel: env.AI_TEXT_MODEL,
    visionModel: env.AI_VISION_MODEL,
    reasoningEffort: parseReasoningEffort(env.AI_REASONING_EFFORT),
  });
}

function readAIProviderEnv(): AIProviderEnv {
  return {
    NODE_ENV: process.env.NODE_ENV,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_TEXT_MODEL: process.env.AI_TEXT_MODEL,
    AI_VISION_MODEL: process.env.AI_VISION_MODEL,
    AI_REASONING_EFFORT: process.env.AI_REASONING_EFFORT,
  };
}

function parseReasoningEffort(value?: string): ReasoningEffort | undefined {
  if (!value) {
    return undefined;
  }

  if (ReasoningEfforts.includes(value as ReasoningEffort)) {
    return value as ReasoningEffort;
  }

  throw new Error(
    `AI_REASONING_EFFORT must be one of: ${ReasoningEfforts.join(", ")}.`,
  );
}
