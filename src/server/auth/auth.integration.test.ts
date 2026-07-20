import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { describe, expect, it } from "vitest";
import * as schema from "@/server/db/schema";
import {
  accounts,
  authSessions,
  corrections,
  users,
} from "@/server/db/schema";
import { createAuth, SESSION_TTL_SECONDS } from "./authFactory";

const testEnv = {
  BETTER_AUTH_URL: "http://localhost:3000",
  BETTER_AUTH_SECRET: "test-secret-with-at-least-thirty-two-characters",
  GOOGLE_CLIENT_ID: "test-google-client-id",
  GOOGLE_CLIENT_SECRET: "test-google-client-secret",
};

const migrationFiles = [
  "0000_left_jackpot.sql",
  "0001_military_iron_fist.sql",
  "0002_lethal_marvel_apes.sql",
  "0003_smart_micromax.sql",
  "0004_puzzling_wiccan.sql",
  "0005_tan_medusa.sql",
  "0006_overrated_master_chief.sql",
];

describe("Better Auth Drizzle integration", () => {
  it("persists users, accounts, and a 90-day cookie session in migrated Postgres", async () => {
    const client = new PGlite();

    try {
      await applyMigrations(client);
      const db = drizzle(client, { schema });
      const testAuth = createAuth({
        database: db,
        enableEmailAndPassword: true,
        env: testEnv,
      });
      const response = await testAuth.handler(
        new Request("http://localhost:3000/api/auth/sign-up/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "Mina",
            email: "mina@example.com",
            password: "strong-test-password",
          }),
        }),
      );

      expect(response.status).toBe(200);
      const cookie = readSessionCookie(response.headers.get("set-cookie"));
      const session = await testAuth.api.getSession({
        headers: new Headers({ cookie }),
      });

      expect(session?.user).toMatchObject({
        name: "Mina",
        email: "mina@example.com",
        level: "beginner",
        explanationLanguage: "en",
      });
      expect(session?.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );

      const [storedSession] = await db
        .select()
        .from(authSessions)
        .where(eq(authSessions.userId, session?.user.id ?? ""));
      expect(storedSession).toBeDefined();
      expect(
        (storedSession?.expiresAt.getTime() ?? 0) -
          (storedSession?.createdAt.getTime() ?? 0),
      ).toBe(SESSION_TTL_SECONDS * 1000);
      await expect(
        db
          .select({
            email: users.email,
            displayName: users.displayName,
            providerId: accounts.providerId,
          })
          .from(users)
          .innerJoin(accounts, eq(accounts.userId, users.id))
          .where(
            and(
              eq(users.id, session?.user.id ?? ""),
              eq(accounts.providerId, "credential"),
            ),
          ),
      ).resolves.toEqual([
        {
          email: "mina@example.com",
          displayName: "Mina",
          providerId: "credential",
        },
      ]);
    } finally {
      await client.close();
    }
  });

  it("stores a Google OAuth identity against the same UUID returned to the app", async () => {
    const client = new PGlite();

    try {
      await applyMigrations(client);
      const db = drizzle(client, { schema });
      const testAuth = createAuth({ database: db, env: testEnv });
      const context = await testAuth.$context;
      const result = await context.internalAdapter.createOAuthUser(
        {
          name: "Google Mina",
          email: "google-mina@example.com",
          emailVerified: true,
          image: null,
        },
        {
          providerId: "google",
          accountId: "google-account-123",
        },
      );

      expect(result.user.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      await expect(
        db
          .select({
            userId: users.id,
            accountUserId: accounts.userId,
            providerId: accounts.providerId,
            accountId: accounts.accountId,
          })
          .from(users)
          .innerJoin(accounts, eq(accounts.userId, users.id))
          .where(eq(users.email, "google-mina@example.com")),
      ).resolves.toEqual([
        {
          userId: result.user.id,
          accountUserId: result.user.id,
          providerId: "google",
          accountId: "google-account-123",
        },
      ]);
    } finally {
      await client.close();
    }
  });

  it("removes disposable invite-era users and their linked test history", async () => {
    const client = new PGlite();

    try {
      await applyMigrations(client, migrationFiles.slice(0, 5));
      const db = drizzle(client, { schema });
      await client.exec(`
        INSERT INTO "users" ("id", "display_name")
        VALUES ('11111111-1111-4111-8111-111111111111', 'Legacy test user');

        INSERT INTO "corrections" (
          "user_id",
          "input_type",
          "original_text",
          "corrected_text"
        ) VALUES (
          '11111111-1111-4111-8111-111111111111',
          'text',
          '테스트 문장',
          '테스트 문장입니다.'
        );
      `);

      await applyMigrations(client, migrationFiles.slice(5));

      await expect(db.select({ id: users.id }).from(users)).resolves.toEqual(
        [],
      );
      await expect(
        db.select({ id: corrections.id }).from(corrections),
      ).resolves.toEqual([]);
    } finally {
      await client.close();
    }
  });
});

async function applyMigrations(
  client: PGlite,
  fileNames = migrationFiles,
) {
  // PGlite does not bundle pgcrypto, but the historical fingerprint migration
  // only needs the function to parse because this isolated database has no
  // quiz rows yet.
  await client.exec(`
    CREATE OR REPLACE FUNCTION digest(value text, algorithm text)
    RETURNS bytea
    LANGUAGE SQL
    IMMUTABLE
    AS $$ SELECT decode(md5(value), 'hex') $$;
  `);

  for (const fileName of fileNames) {
    const migration = await readFile(
      join(process.cwd(), "src/server/db/migrations", fileName),
      "utf8",
    );

    for (const statement of migration.split("--> statement-breakpoint")) {
      if (
        statement.trim() &&
        !statement.includes('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
      ) {
        await client.exec(statement);
      }
    }
  }
}

function readSessionCookie(setCookieHeader: string | null) {
  const match = setCookieHeader?.match(/better-auth\.session_token=([^;]+)/);
  if (!match?.[1]) {
    throw new Error("Better Auth session cookie was not set.");
  }

  return `better-auth.session_token=${match[1]}`;
}
