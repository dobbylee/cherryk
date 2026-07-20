import { loadEnvConfig } from "@next/env";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDbConnection } from "@/server/db";
import { dailyUsage, users } from "@/server/db/schema";
import { createUsageRepository } from "./usageRepository";

loadEnvConfig(process.cwd());

const describeWithDatabase =
  process.env.RUN_DB_TESTS === "true" ? describe : describe.skip;

describeWithDatabase("usageRepository database concurrency", () => {
  it("allows no more than the configured number of concurrent uses", async () => {
    const connection = createDbConnection(
      process.env.DATABASE_URL ??
        "postgres://cherryk:cherryk@localhost:5433/cherryk",
    );
    const [user] = await connection.db
      .insert(users)
      .values({ displayName: "Usage test" })
      .returning({ id: users.id });

    if (!user) {
      await connection.close();
      throw new Error("Failed to create usage test user.");
    }

    const usageDate = "2026-07-21";
    const repository = createUsageRepository(connection.db);

    try {
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          repository.consumeIfAvailable({
            userId: user.id,
            usageDate,
            kind: "correction",
            limit: 2,
            now: new Date("2026-07-21T12:00:00.000Z"),
          }),
        ),
      );

      expect(results.filter(Boolean)).toHaveLength(2);
      await expect(
        connection.db
          .select({ count: dailyUsage.correctionCount })
          .from(dailyUsage)
          .where(
            and(
              eq(dailyUsage.userId, user.id),
              eq(dailyUsage.usageDate, usageDate),
            ),
          ),
      ).resolves.toEqual([{ count: 2 }]);
    } finally {
      await connection.db.delete(users).where(eq(users.id, user.id));
      await connection.close();
    }
  });
});
