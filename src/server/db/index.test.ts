import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const end = vi.fn(async () => undefined);

  return {
    drizzle: vi.fn(() => ({})),
    end,
    postgres: vi.fn(() => ({ end })),
  };
});

vi.mock("drizzle-orm/postgres-js", () => ({
  drizzle: mocks.drizzle,
}));

vi.mock("postgres", () => ({
  default: mocks.postgres,
}));

import {
  createDb,
  createDbConnection,
  createPostgresClient,
} from "./index";

const databaseGlobal = globalThis as typeof globalThis & {
  __cherrykPostgresClient?: unknown;
};

describe("database client lifecycle", () => {
  beforeEach(() => {
    delete databaseGlobal.__cherrykPostgresClient;
    vi.clearAllMocks();
  });

  it("reuses one shared client for request-scoped database wrappers", () => {
    createDb("postgres://shared");
    createDb("postgres://shared");
    createPostgresClient("postgres://shared");

    expect(mocks.postgres).toHaveBeenCalledOnce();
    expect(mocks.postgres).toHaveBeenCalledWith("postgres://shared", {
      max: 5,
      prepare: false,
      connect_timeout: 10,
      idle_timeout: 20,
      max_lifetime: 30 * 60,
    });
  });

  it("keeps closable script connections separate from the shared client", async () => {
    createDb("postgres://shared");
    const connection = createDbConnection("postgres://script");

    expect(mocks.postgres).toHaveBeenCalledTimes(2);

    await connection.close();

    expect(mocks.end).toHaveBeenCalledOnce();
  });
});
