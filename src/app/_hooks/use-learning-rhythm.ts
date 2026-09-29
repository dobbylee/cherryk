"use client";

import { useEffect, useState } from "react";
import { fetchLearningRhythm } from "@/lib/api/learning";
import type { LearningRhythmResponse } from "@/lib/contracts/learning";

type RhythmState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: LearningRhythmResponse };

export function useLearningRhythm() {
  const [state, setState] = useState<RhythmState>({ status: "loading" });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let controller: AbortController | undefined;
    let lastLocalDay = "";
    let lastTimeZone = "";
    let disposed = false;

    async function load(force: boolean) {
      const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const localDay = new Date().toLocaleDateString("en-CA", { timeZone });
      if (!force && localDay === lastLocalDay && timeZone === lastTimeZone)
        return;
      lastLocalDay = localDay;
      lastTimeZone = timeZone;
      controller?.abort();
      const request = new AbortController();
      controller = request;
      setState({ status: "loading" });
      try {
        const data = await fetchLearningRhythm(timeZone, request.signal);
        if (!disposed && !request.signal.aborted)
          setState({ status: "ready", data });
      } catch {
        if (!disposed && !request.signal.aborted) setState({ status: "error" });
      }
    }

    const refresh = () => {
      void load(true);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, 60_000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    void load(true);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [retry]);

  return { state, retry: () => setRetry((value) => value + 1) };
}
