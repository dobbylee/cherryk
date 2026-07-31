import { z } from "zod";

export const UserLevels = [
  "beginner",
  "lower_intermediate",
  "intermediate",
] as const;

export const UserLevelSchema = z.enum(UserLevels);

// IDs stay strings at the API boundary so clients never depend on JavaScript
// number precision. The Spring backend exposes positive PostgreSQL BIGINT values.
export const EntityIdSchema = z.string().regex(/^[1-9]\d*$/);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type UserLevel = z.infer<typeof UserLevelSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
