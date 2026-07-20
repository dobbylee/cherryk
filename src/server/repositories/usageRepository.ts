import { lt, sql } from "drizzle-orm";
import type { Db } from "@/server/db";
import { dailyUsage } from "@/server/db/schema";

export type AIUsageKind = "correction" | "ocr";

export type ConsumeUsageInput = {
  userId: string;
  usageDate: string;
  kind: AIUsageKind;
  limit: number;
  now: Date;
};

export type UsageRepository = {
  consumeIfAvailable(input: ConsumeUsageInput): Promise<boolean>;
};

export function createUsageRepository(db: Db): UsageRepository {
  return {
    consumeIfAvailable: (input) => consumeIfAvailable(db, input),
  };
}

async function consumeIfAvailable(db: Db, input: ConsumeUsageInput) {
  const countColumn =
    input.kind === "correction"
      ? dailyUsage.correctionCount
      : dailyUsage.ocrCount;
  const insertValues =
    input.kind === "correction" ? { correctionCount: 1 } : { ocrCount: 1 };
  const updateValues =
    input.kind === "correction"
      ? { correctionCount: sql`${dailyUsage.correctionCount} + 1` }
      : { ocrCount: sql`${dailyUsage.ocrCount} + 1` };

  const [usage] = await db
    .insert(dailyUsage)
    .values({
      userId: input.userId,
      usageDate: input.usageDate,
      updatedAt: input.now,
      ...insertValues,
    })
    .onConflictDoUpdate({
      target: [dailyUsage.userId, dailyUsage.usageDate],
      set: {
        ...updateValues,
        updatedAt: input.now,
      },
      setWhere: lt(countColumn, input.limit),
    })
    .returning({ count: countColumn });

  return Boolean(usage);
}
