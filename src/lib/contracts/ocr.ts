import { z } from "zod";

export const OCRAIOutputSchema = z.object({
  extractedText: z.string(),
  note: z.string().optional(),
});

export const OCRExtractResponseSchema = OCRAIOutputSchema;

export type OCRAIOutput = z.infer<typeof OCRAIOutputSchema>;
export type OCRExtractResponse = z.infer<typeof OCRExtractResponseSchema>;
