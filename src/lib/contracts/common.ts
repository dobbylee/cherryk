import { z } from "zod";

export const UserLevelSchema = z.enum([
  "beginner",
  "lower_intermediate",
  "intermediate",
]);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type UserLevel = z.infer<typeof UserLevelSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
