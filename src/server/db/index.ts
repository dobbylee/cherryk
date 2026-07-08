import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createPostgresClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  return postgres(databaseUrl, {
    max: 5,
    prepare: false,
  });
}

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  const client = createPostgresClient(databaseUrl);

  return drizzle(client, { schema });
}

export function createDbConnection(databaseUrl = process.env.DATABASE_URL) {
  const client = createPostgresClient(databaseUrl);

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export type Db = ReturnType<typeof createDb>;
