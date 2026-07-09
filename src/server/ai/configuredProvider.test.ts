import { describe, expect, it } from "vitest";
import { mockAIProvider } from "./mockAIProvider";
import { createAIProvider } from "./configuredProvider";

describe("createAIProvider", () => {
  it("uses the mock provider when OPENAI_API_KEY is absent", () => {
    expect(createAIProvider({})).toBe(mockAIProvider);
  });

  it("uses the OpenAI provider when OPENAI_API_KEY is present", () => {
    expect(
      createAIProvider({
        OPENAI_API_KEY: "test-key",
        AI_TEXT_MODEL: "test-text-model",
        AI_VISION_MODEL: "test-vision-model",
      }),
    ).not.toBe(mockAIProvider);
  });
});
