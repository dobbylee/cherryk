type RequestTracker = {
  current: number;
};

type LatestRequestResult<T> =
  | { status: "success"; value: T }
  | { status: "error"; error: unknown }
  | { status: "stale" };

export async function runLatestRequest<T>(
  tracker: RequestTracker,
  request: () => Promise<T>,
): Promise<LatestRequestResult<T>> {
  const requestId = tracker.current + 1;
  tracker.current = requestId;

  try {
    const value = await request();
    return tracker.current === requestId
      ? { status: "success", value }
      : { status: "stale" };
  } catch (error) {
    return tracker.current === requestId
      ? { status: "error", error }
      : { status: "stale" };
  }
}

export function invalidateLatestRequest(tracker: RequestTracker) {
  tracker.current += 1;
}
