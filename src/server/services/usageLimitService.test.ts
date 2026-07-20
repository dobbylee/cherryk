import { describe, expect, it, vi } from "vitest";
import type { UsageRepository } from "@/server/repositories/usageRepository";
import { createUsageLimitService, UsageLimitError } from "./usageLimitService";

const userId = "11111111-1111-4111-8111-111111111111";
const now = new Date("2026-07-21T23:30:00.000Z");

describe("usageLimitService", () => {
  it("consumes an atomic UTC-day usage slot with the configured limit", async () => {
    const consumeIfAvailable = vi.fn().mockResolvedValue(true);
    const service = createUsageLimitService(
      { consumeIfAvailable } satisfies UsageRepository,
      { correctionLimit: 3, ocrLimit: 2 },
    );

    await service.consume(userId, "correction", now);

    expect(consumeIfAvailable).toHaveBeenCalledWith({
      userId,
      usageDate: "2026-07-21",
      kind: "correction",
      limit: 3,
      now,
    });
  });

  it("rejects the request when no usage slot remains", async () => {
    const service = createUsageLimitService(
      {
        consumeIfAvailable: vi.fn().mockResolvedValue(false),
      },
      { correctionLimit: 3, ocrLimit: 2 },
    );

    await expect(service.consume(userId, "ocr", now)).rejects.toEqual(
      new UsageLimitError("ocr"),
    );
  });

  it("blocks a feature when its configured limit is zero", async () => {
    const consumeIfAvailable = vi.fn();
    const service = createUsageLimitService(
      { consumeIfAvailable },
      { correctionLimit: 0, ocrLimit: 2 },
    );

    await expect(
      service.consume(userId, "correction", now),
    ).rejects.toMatchObject({ code: "daily_limit_reached" });
    expect(consumeIfAvailable).not.toHaveBeenCalled();
  });
});
