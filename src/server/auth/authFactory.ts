import {
  drizzleAdapter,
  type DB as BetterAuthDatabase,
} from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import { createDb } from "@/server/db";
import * as schema from "@/server/db/schema";

export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 90;

type AuthEnvironment = Pick<
  NodeJS.ProcessEnv,
  | "BETTER_AUTH_URL"
  | "BETTER_AUTH_SECRET"
  | "GOOGLE_CLIENT_ID"
  | "GOOGLE_CLIENT_SECRET"
>;

type CreateAuthOptions = {
  database?: BetterAuthDatabase;
  enableEmailAndPassword?: boolean;
  env?: AuthEnvironment;
};

export function createAuth(options: CreateAuthOptions = {}) {
  const env = options.env ?? process.env;

  return betterAuth({
    appName: "CherryK",
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(options.database ?? createDb(), {
      provider: "pg",
      schema: {
        ...schema,
        user: schema.users,
        session: schema.authSessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: options.enableEmailAndPassword ?? false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: env.GOOGLE_CLIENT_SECRET ?? "",
      },
    },
    user: {
      modelName: "users",
      fields: {
        name: "displayName",
      },
      additionalFields: {
        level: {
          type: "string",
          required: false,
          defaultValue: "beginner",
          input: false,
        },
        explanationLanguage: {
          type: "string",
          required: false,
          defaultValue: "en",
          input: false,
        },
      },
    },
    session: {
      modelName: "authSessions",
      expiresIn: SESSION_TTL_SECONDS,
      updateAge: 60 * 60 * 24,
    },
    account: {
      modelName: "accounts",
    },
    verification: {
      modelName: "verifications",
    },
    advanced: {
      database: {
        generateId: "uuid",
      },
    },
  });
}
