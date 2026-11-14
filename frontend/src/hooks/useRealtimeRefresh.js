import { useEffect, useRef } from "react";

/**
 * Refresh only when the server reports a change
 * to one of the requested topics.
 *
 * Usage:
 * useRealtimeRefresh(["inventory", "catalog"], setRevision);
 */
export default function useRealtimeRefresh(topics, onRefresh) {
  const callbackRef = useRef(onRefresh);
  callbackRef.current = onRefresh;

  // Prevent unnecessary event-listener replacement
  // when a component supplies a new array each render.
  const topicKey = Array.isArray(topics)
    ? [...new Set(topics.map(String))].sort().join("|")
    : "";

  useEffect(() => {
    const wanted = new Set(topicKey.split("|").filter(Boolean));

    let pending = null;

    function onChange(event) {
      const changed = event?.detail?.topics;

      if (!Array.isArray(changed) || changed.length === 0) {
        return;
      }

      if (!changed.some((topic) => wanted.has(topic))) {
        return;
      }

      if (pending !== null) return;

      // Combine notifications arriving close together.
      pending = window.setTimeout(() => {
        pending = null;

        callbackRef.current?.((previous) => previous + 1);
      }, 150);
    }

    window.addEventListener("av-realtime-change", onChange);

    return () => {
      window.removeEventListener("av-realtime-change", onChange);

      if (pending !== null) {
        window.clearTimeout(pending);
      }
    };
  }, [topicKey]);
}
