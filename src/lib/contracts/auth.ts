import { z } from "zod";
import { UserLevelSchema } from "./common";

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  level: UserLevelSchema,
});

export const MeResponseSchema = z.object({
  user: AuthUserSchema.nullable(),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
