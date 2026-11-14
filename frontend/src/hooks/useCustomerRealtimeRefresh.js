import { useEffect, useRef } from "react";

/**
 * Update a customer page when a relevant SSE topic changes.
 * The existing authorized API call still fetches the actual data.
 * A quiet, visible-tab fallback covers dropped or blocked SSE connections.
 */
export default function useCustomerRealtimeRefresh(topics, refresh) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const topicKey = [...new Set(topics)].sort().join("|");

  useEffect(() => {
    const wanted = new Set(topicKey.split("|").filter(Boolean));
    let pending = null;
    let lastRefreshAt = Date.now();

    function scheduleRefresh(force = false) {
      if (document.visibilityState === "hidden" || pending !== null) return;
      if (!force && Date.now() - lastRefreshAt < 10000) return;

      pending = window.setTimeout(() => {
        pending = null;
        lastRefreshAt = Date.now();
        refreshRef.current?.();
      }, 150);
    }

    function onRealtime(event) {
      const changes = event.detail?.topics;
      if (
        Array.isArray(changes) &&
        changes.some((topic) => wanted.has(topic))
      ) {
        scheduleRefresh(true);
      }
    }

    function onVisible() {
      if (document.visibilityState === "visible") scheduleRefresh();
    }

    function onFocus() {
      scheduleRefresh();
    }

    window.addEventListener("av-realtime-change", onRealtime);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);

    // Backup only. SSE is the primary path, so changes usually show sooner.
    const fallback = window.setInterval(() => scheduleRefresh(), 60000);

    return () => {
      window.removeEventListener("av-realtime-change", onRealtime);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
      window.clearInterval(fallback);
      if (pending !== null) window.clearTimeout(pending);
    };
  }, [topicKey]);
}
