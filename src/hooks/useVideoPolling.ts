import { useEffect, useRef } from "react";
import { pollVideoStatus } from "../lib/api";
import type { Generation } from "../types";

export function useVideoPolling(
  row: Generation | null,
  onUpdate: (x: Generation) => void,
  onError: (x: string) => void,
) {
  const attempts = useRef(0);
  useEffect(() => {
    if (!row || row.type !== "video" || row.status !== "processing") return;
    attempts.current = 0;
    const timer = window.setInterval(async () => {
      try {
        attempts.current++;
        const next = await pollVideoStatus(row.id);
        onUpdate(next);
        if (next.status === "completed" || next.status === "failed")
          clearInterval(timer);
        if (attempts.current >= 90) {
          clearInterval(timer);
          onError("Automatic polling paused. Resume from History.");
        }
      } catch (e) {
        clearInterval(timer);
        onError(e instanceof Error ? e.message : "Video status failed");
      }
    }, 10000);
    return () => clearInterval(timer);
  }, [row?.id, row?.status]);
}
