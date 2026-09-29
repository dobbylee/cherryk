import { z } from "zod";

export const LearningRhythmResponseSchema = z
  .object({
    timeZone: z.string().min(1),
    today: z.iso.date(),
    currentStreak: z.number().int().nonnegative(),
    days: z
      .array(z.object({ date: z.iso.date(), active: z.boolean() }))
      .length(7),
  })
  .superRefine((value, ctx) => {
    const today = Date.parse(`${value.today}T00:00:00Z`);
    if (
      value.days.some(
        (day, index) =>
          Date.parse(`${day.date}T00:00:00Z`) !==
          today - (6 - index) * 86_400_000,
      )
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["days"],
        message: "Days must end today in consecutive order.",
      });
    }
  });

export type LearningRhythmResponse = z.infer<
  typeof LearningRhythmResponseSchema
>;
