import type {
  AIUsageKind,
  UsageRepository,
} from "@/server/repositories/usageRepository";

const DEFAULT_DAILY_CORRECTION_LIMIT = 20;
const DEFAULT_DAILY_OCR_LIMIT = 10;

export class UsageLimitError extends Error {
  readonly code = "daily_limit_reached";

  constructor(readonly kind: AIUsageKind) {
    super(
      kind === "correction"
        ? "Daily correction limit reached. Try again tomorrow."
        : "Daily photo upload limit reached. Try again tomorrow.",
    );
    this.name = "UsageLimitError";
  }
}

export type UsageLimiter = {
  consume(userId: string, kind: AIUsageKind, now?: Date): Promise<void>;
};

type UsageLimitServiceOptions = {
  correctionLimit?: number;
  ocrLimit?: number;
};

export function createUsageLimitService(
  repository: UsageRepository,
  options: UsageLimitServiceOptions = {},
): UsageLimiter {
  const limits = {
    correction:
      options.correctionLimit ??
      readDailyLimit("DAILY_CORRECTION_LIMIT", DEFAULT_DAILY_CORRECTION_LIMIT),
    ocr:
      options.ocrLimit ??
      readDailyLimit("DAILY_OCR_LIMIT", DEFAULT_DAILY_OCR_LIMIT),
  } satisfies Record<AIUsageKind, number>;

  return {
    async consume(userId, kind, now = new Date()) {
      const limit = limits[kind];
      if (limit <= 0) {
        throw new UsageLimitError(kind);
      }

      const consumed = await repository.consumeIfAvailable({
        userId,
        usageDate: now.toISOString().slice(0, 10),
        kind,
        limit,
        now,
      });

      if (!consumed) {
        throw new UsageLimitError(kind);
      }
    },
  };
}

function readDailyLimit(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return value;
}
