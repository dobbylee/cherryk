import { z } from "zod";

export const AdminInviteUserSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  inviteLabel: z.string().nullable(),
});

export const AdminInviteUsersResponseSchema = z.object({
  users: z.array(AdminInviteUserSchema),
});

export const AdminInviteCreateRequestSchema = z.object({
  label: z.string().trim().min(1).max(80),
  userId: z.uuid().optional(),
});

export const AdminInviteCreateResponseSchema = z.object({
  kind: z.enum(["invite", "recovery"]),
  link: z.url(),
});

export type AdminInviteUser = z.infer<typeof AdminInviteUserSchema>;
export type AdminInviteUsersResponse = z.infer<
  typeof AdminInviteUsersResponseSchema
>;
export type AdminInviteCreateRequest = z.infer<
  typeof AdminInviteCreateRequestSchema
>;
export type AdminInviteCreateResponse = z.infer<
  typeof AdminInviteCreateResponseSchema
>;
