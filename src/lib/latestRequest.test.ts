import { describe, expect, it } from "vitest";
import { invalidateLatestRequest, runLatestRequest } from "./latestRequest";

describe("runLatestRequest", () => {
  it("keeps only the newest result when requests overlap", async () => {
    const tracker = { current: 0 };
    const first = deferred<string>();
    const second = deferred<string>();

    const firstResult = runLatestRequest(tracker, () => first.promise);
    const secondResult = runLatestRequest(tracker, () => second.promise);

    second.resolve("new filters");
    expect(await secondResult).toEqual({
      status: "success",
      value: "new filters",
    });

    first.resolve("old filters");
    expect(await firstResult).toEqual({ status: "stale" });
  });

  it("marks an in-flight request stale when invalidated", async () => {
    const tracker = { current: 0 };
    const pending = deferred<string>();
    const result = runLatestRequest(tracker, () => pending.promise);

    invalidateLatestRequest(tracker);
    pending.reject(new Error("late failure"));

    expect(await result).toEqual({ status: "stale" });
  });
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}
