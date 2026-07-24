import { z } from "zod";
import { EntityIdSchema, UserLevelSchema } from "./common";

export const AuthUserSchema = z.object({
  id: EntityIdSchema,
  displayName: z.string().nullable(),
  level: UserLevelSchema,
});

export const MeResponseSchema = z.object({
  user: AuthUserSchema.nullable(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
