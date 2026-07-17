import { sql } from "drizzle-orm";
import type { CorrectionAIOutput } from "@/lib/contracts/correction";
import type { GrammarTag } from "@/lib/contracts/grammar-tags";
import type { Db } from "@/server/db";
import {
  correctionMistakes,
  corrections,
  userTagStats,
} from "@/server/db/schema";

export type CreateCorrectionRecordInput = {
  userId: string;
  inputType: "text" | "image_ocr";
  originalText: string;
  extractedText?: string;
  aiOutput: CorrectionAIOutput;
  recommendedTags: GrammarTag[];
  now: Date;
};

export type CorrectionRepository = {
  createCorrectionRecord(
    input: CreateCorrectionRecordInput,
  ): Promise<{ correctionId: string }>;
};

export function createCorrectionRepository(db: Db): CorrectionRepository {
  return {
    createCorrectionRecord: (input) => createCorrectionRecord(db, input),
  };
}

async function createCorrectionRecord(
  db: Db,
  input: CreateCorrectionRecordInput,
) {
  return db.transaction(async (tx) => {
    const [correction] = await tx
      .insert(corrections)
      .values({
        userId: input.userId,
        inputType: input.inputType,
        originalText: input.originalText,
        extractedText: input.extractedText,
        correctedText: input.aiOutput.correctedText,
        explanationEn: input.aiOutput.explanationEn,
      })
      .returning({ id: corrections.id });

    if (!correction) {
      throw new Error("Failed to create correction.");
    }

    if (input.aiOutput.mistakes.length > 0) {
      await tx.insert(correctionMistakes).values(
        input.aiOutput.mistakes.map((mistake) => ({
          correctionId: correction.id,
          tag: mistake.tag,
          originalPart: mistake.originalPart,
          correctedPart: mistake.correctedPart,
          explanationEn: mistake.explanationEn,
          severity: mistake.severity,
        })),
      );
    }

    for (const tag of input.recommendedTags) {
      await tx
        .insert(userTagStats)
        .values({
          userId: input.userId,
          tag,
          count: 1,
          lastSeenAt: input.now,
        })
        .onConflictDoUpdate({
          target: [userTagStats.userId, userTagStats.tag],
          set: {
            count: sql`${userTagStats.count} + 1`,
            lastSeenAt: input.now,
          },
        });
    }

    return { correctionId: correction.id };
  });
}
