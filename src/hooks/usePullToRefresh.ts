import { useEffect, useRef, useState } from "react";

/** Arrastar o topo da página para baixo dispara onRefresh. */
export function usePullToRefresh(onRefresh: () => Promise<unknown> | void, threshold = 70) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);
  const cb = useRef(onRefresh);
  cb.current = onRefresh;

  useEffect(() => {
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const d = e.touches[0].clientY - startY.current;
      pullRef.current = d > 0 ? Math.min(d * 0.5, threshold * 1.5) : 0;
      setPull(pullRef.current);
    };
    const onEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pullRef.current >= threshold) {
        setRefreshing(true);
        try { await cb.current(); } finally { setRefreshing(false); }
      }
      pullRef.current = 0;
      setPull(0);
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [threshold]);

  return { pull, refreshing, ready: pull >= threshold };
}
