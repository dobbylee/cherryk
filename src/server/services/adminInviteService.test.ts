import { describe, expect, it } from "vitest";
import { hashInviteCode } from "@/server/auth/session";
import type {
  CreateOneTimeInviteInput,
  InviteRepository,
} from "@/server/repositories/inviteRepository";
import {
  AdminInviteServiceError,
  createAdminInviteService,
} from "./adminInviteService";

const testUser = {
  id: "11111111-1111-4111-8111-111111111111",
  displayName: "Mina",
};

function createFakeRepository(
  overrides: Partial<InviteRepository> = {},
): InviteRepository & { createdInvite: CreateOneTimeInviteInput | null } {
  const repository: InviteRepository & {
    createdInvite: CreateOneTimeInviteInput | null;
  } = {
    createdInvite: null,
    async createOneTimeInvite(input) {
      repository.createdInvite = input;
    },
    async findUserById(userId) {
      return userId === testUser.id ? testUser : null;
    },
    async listUsers() {
      return [testUser];
    },
    ...overrides,
  };

  return repository;
}

describe("adminInviteService", () => {
  it("creates a one-time onboarding link without storing the raw code", async () => {
    const repository = createFakeRepository();
    const service = createAdminInviteService(repository, {
      authSecret: "test-secret",
      createCode: () => "raw-invite-code",
    });

    const response = await service.createInviteLink(
      { label: "Mina invite" },
      "https://cherryk.example",
    );

    expect(response).toEqual({
      kind: "invite",
      link: "https://cherryk.example/join?invite=raw-invite-code",
    });
    expect(repository.createdInvite).toEqual({
      codeHash: hashInviteCode("raw-invite-code", "test-secret"),
      label: "Mina invite",
      userId: null,
    });
  });

  it("creates a recovery link bound to an existing user", async () => {
    const repository = createFakeRepository();
    const service = createAdminInviteService(repository, {
      authSecret: "test-secret",
      createCode: () => "raw-recovery-code",
    });

    const response = await service.createInviteLink(
      { label: "Mina recovery", userId: testUser.id },
      "https://cherryk.example",
    );

    expect(response).toEqual({
      kind: "recovery",
      link: "https://cherryk.example/join?recovery=raw-recovery-code",
    });
    expect(repository.createdInvite?.userId).toBe(testUser.id);
  });

  it("rejects recovery links for users that do not exist", async () => {
    const repository = createFakeRepository();
    const service = createAdminInviteService(repository, {
      authSecret: "test-secret",
      createCode: () => "unused-code",
    });

    await expect(
      service.createInviteLink(
        {
          label: "Missing user",
          userId: "22222222-2222-4222-8222-222222222222",
        },
        "https://cherryk.example",
      ),
    ).rejects.toBeInstanceOf(AdminInviteServiceError);
    expect(repository.createdInvite).toBeNull();
  });

  it("lists users available for recovery", async () => {
    const service = createAdminInviteService(createFakeRepository(), {
      authSecret: "test-secret",
    });

    await expect(service.listUsers()).resolves.toEqual({ users: [testUser] });
  });
});
