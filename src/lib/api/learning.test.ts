import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLearningRhythm } from "./learning";
import fixtures from "@/lib/contracts/fixtures/api-v1.json";
import { LearningRhythmResponseSchema } from "@/lib/contracts/learning";

afterEach(() => vi.unstubAllGlobals());

describe("learning rhythm contract", () => {
  it("passes the IANA zone and abort signal without caching personal activity", async () => {
    const fetch = vi.fn(
      async () => new Response(JSON.stringify(fixtures.learningRhythmResponse)),
    );
    vi.stubGlobal("fetch", fetch);
    const signal = new AbortController().signal;
    await fetchLearningRhythm("Asia/Seoul", signal);
    expect(fetch).toHaveBeenCalledWith(
      "/api/v1/learning/rhythm?timeZone=Asia%2FSeoul",
      expect.objectContaining({ cache: "no-store", signal }),
    );
  });
  it("rejects reordered or fabricated dates and negative streaks", () => {
    const fixture = fixtures.learningRhythmResponse;
    expect(
      LearningRhythmResponseSchema.safeParse({
        ...fixture,
        days: [...fixture.days].reverse(),
      }).success,
    ).toBe(false);
    expect(
      LearningRhythmResponseSchema.safeParse({
        ...fixture,
        today: "2026-02-30",
      }).success,
    ).toBe(false);
    expect(
      LearningRhythmResponseSchema.safeParse({ ...fixture, currentStreak: -1 })
        .success,
    ).toBe(false);
  });
});
