import { z } from "zod";
import { UserLevelSchema } from "./common";
import { GrammarTagSchema } from "./grammar-tags";

export const CorrectionInputSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  inputType: z.enum(["text", "image_ocr"]),
  extractedText: z.string().trim().max(4000).optional(),
  level: UserLevelSchema,
  correctionStyle: z.literal("minimal"),
});

export const CorrectionMistakeSchema = z.object({
  tag: GrammarTagSchema,
  originalPart: z.string(),
  correctedPart: z.string(),
  explanationEn: z.string(),
  severity: z.enum(["minor", "major"]),
});

export const CorrectionAIOutputSchema = z.object({
  correctedText: z.string(),
  explanationEn: z.string(),
  mistakes: z.array(CorrectionMistakeSchema),
});

export const CorrectionResponseSchema = CorrectionAIOutputSchema.extend({
  correctionId: z.string().uuid(),
  originalText: z.string(),
  recommendedTags: z.array(GrammarTagSchema),
});

export type CorrectionInput = z.infer<typeof CorrectionInputSchema>;
export type CorrectionAIOutput = z.infer<typeof CorrectionAIOutputSchema>;
export type CorrectionResponse = z.infer<typeof CorrectionResponseSchema>;
