import { mockAIProvider } from "./mockAIProvider";
import { createOpenAIProvider } from "./openaiProvider";
import type { AIProvider } from "./provider";

type AIProviderEnv = {
  OPENAI_API_KEY?: string;
  AI_TEXT_MODEL?: string;
  AI_VISION_MODEL?: string;
};

export function createAIProvider(env: AIProviderEnv = readAIProviderEnv()): AIProvider {
  if (!env.OPENAI_API_KEY) {
    return mockAIProvider;
  }

  return createOpenAIProvider({
    apiKey: env.OPENAI_API_KEY,
    textModel: env.AI_TEXT_MODEL,
    visionModel: env.AI_VISION_MODEL,
  });
}

function readAIProviderEnv(): AIProviderEnv {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    AI_TEXT_MODEL: process.env.AI_TEXT_MODEL,
    AI_VISION_MODEL: process.env.AI_VISION_MODEL,
  };
}
