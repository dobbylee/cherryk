import { loadEnvConfig } from "@next/env";
import { requireAuthSecret } from "@/server/auth/session";
import { createDbConnection } from "@/server/db";
import { createAuthRepository } from "@/server/repositories/authRepository";
import { createAuthService } from "@/server/services/authService";

loadEnvConfig(process.cwd());

async function main() {
  const inviteCode = process.env.INVITE_CODE_SEED?.trim();

  if (!inviteCode) {
    throw new Error("INVITE_CODE_SEED is required.");
  }

  requireAuthSecret();

  const connection = createDbConnection();

  try {
    await createAuthService(createAuthRepository(connection.db)).seedInviteCode(
      {
        inviteCode,
        label: "Initial invite",
        maxUses: 20,
      },
    );

    console.log("Seeded invite code from INVITE_CODE_SEED.");
  } finally {
    await connection.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
