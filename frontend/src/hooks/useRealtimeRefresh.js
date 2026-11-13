import { useEffect } from "react";

/**
 * Refresh only when SSE reports an actual business change.
 *
 * Does not refresh when:
 * - Switching browser tabs
 * - Using Alt+Tab
 * - SSE reconnects
 * - SSE sends a heartbeat
 *
 * Example:
 * useRealtimeRefresh(["orders", "payments"], setRevision);
 */
export default function useRealtimeRefresh(topics, onRefresh) {
  const topicKey = Array.isArray(topics)
    ? [...new Set(topics.map(String))].sort().join("|")
    : "";

  useEffect(() => {
    const wantedTopics = new Set(topicKey.split("|").filter(Boolean));

    let pendingTimer = null;

    function handleBusinessChange(event) {
      const changedTopics = event?.detail?.topics;

      if (!Array.isArray(changedTopics) || changedTopics.length === 0) {
        return;
      }

      if (!changedTopics.some((topic) => wantedTopics.has(topic))) {
        return;
      }

      // Combine rapid SSE notifications into one refresh.
      if (pendingTimer !== null) {
        return;
      }

      pendingTimer = window.setTimeout(() => {
        pendingTimer = null;

        if (typeof onRefresh === "function") {
          onRefresh((previous) => previous + 1);
        }
      }, 150);
    }

    window.addEventListener("av-realtime-change", handleBusinessChange);

    return () => {
      window.removeEventListener("av-realtime-change", handleBusinessChange);

      if (pendingTimer !== null) {
        window.clearTimeout(pendingTimer);
      }
    };
  }, [topicKey, onRefresh]);
}
