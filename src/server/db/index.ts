import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type PostgresClient = ReturnType<typeof postgres>;

type SharedPostgresClient = {
  databaseUrl: string;
  client: PostgresClient;
};

const databaseGlobal = globalThis as typeof globalThis & {
  __cherrykPostgresClient?: SharedPostgresClient;
};

export function createPostgresClient(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const sharedClient = databaseGlobal.__cherrykPostgresClient;
  if (sharedClient?.databaseUrl === databaseUrl) {
    return sharedClient.client;
  }

  if (sharedClient) {
    void sharedClient.client.end({ timeout: 1 });
  }

  const client = createDedicatedPostgresClient(databaseUrl);
  databaseGlobal.__cherrykPostgresClient = { databaseUrl, client };

  return client;
}

function createDedicatedPostgresClient(databaseUrl: string) {
  return postgres(databaseUrl, {
    max: 5,
    prepare: false,
    connect_timeout: 10,
    idle_timeout: 20,
    max_lifetime: 30 * 60,
  });
}

export function createDb(databaseUrl = process.env.DATABASE_URL) {
  const client = createPostgresClient(databaseUrl);

  return drizzle(client, { schema });
}

export function createDbConnection(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const client = createDedicatedPostgresClient(databaseUrl);

  return {
    db: drizzle(client, { schema }),
    close: () => client.end(),
  };
}

export type Db = ReturnType<typeof createDb>;
