import { z } from "zod";

export const UserLevels = [
  "beginner",
  "lower_intermediate",
  "intermediate",
] as const;

export const UserLevelSchema = z.enum(UserLevels);

// IDs are opaque strings at the API boundary. UUIDs are accepted while the
// Next.js backend remains active; Spring returns decimal BIGINT identities.
export const EntityIdSchema = z.union([
  z.string().uuid(),
  z.string().regex(/^[1-9]\d*$/),
]);

export const ApiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type UserLevel = z.infer<typeof UserLevelSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
