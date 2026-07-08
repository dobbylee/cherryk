import { z } from "zod";
import { UserLevelSchema } from "./common";

export const AuthUserSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  level: UserLevelSchema,
});

export const InviteLoginRequestSchema = z.object({
  inviteCode: z.string().trim().min(1).max(128),
  displayName: z.string().trim().min(1).max(80).optional(),
});

export const InviteLoginResponseSchema = z.object({
  user: AuthUserSchema,
});

export const MeResponseSchema = z.object({
  user: AuthUserSchema.nullable(),
});

export const LogoutResponseSchema = z.object({
  ok: z.literal(true),
});

export type AuthUser = z.infer<typeof AuthUserSchema>;
export type InviteLoginRequest = z.infer<typeof InviteLoginRequestSchema>;
export type InviteLoginResponse = z.infer<typeof InviteLoginResponseSchema>;
export type MeResponse = z.infer<typeof MeResponseSchema>;
export type LogoutResponse = z.infer<typeof LogoutResponseSchema>;
