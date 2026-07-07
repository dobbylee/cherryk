import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = postgres(databaseUrl, {
    max: 5,
    prepare: false,
  });

  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
