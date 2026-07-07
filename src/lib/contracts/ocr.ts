import { z } from "zod";

export const OCRAIOutputSchema = z.object({
  extractedText: z.string(),
  note: z.string().optional(),
});

export type OCRAIOutput = z.infer<typeof OCRAIOutputSchema>;
