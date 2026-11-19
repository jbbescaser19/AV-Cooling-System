import { useEffect, useRef } from "react";

export default function useRealtimeRefresh(topics, onRefresh) {
  const callbackRef = useRef(onRefresh);

  callbackRef.current = onRefresh;

  const topicKey = Array.isArray(topics)
    ? [...new Set(topics.map(String))].sort().join("|")
    : "";

  useEffect(() => {
    const wanted = new Set(topicKey.split("|").filter(Boolean));

    const needsBackup = wanted.has("customers") || wanted.has("schedules");

    let pending = null;
    let lastRefresh = Date.now();

    function scheduleRefresh() {
      if (pending !== null) return;

      pending = window.setTimeout(() => {
        pending = null;

        lastRefresh = Date.now();

        callbackRef.current?.((previous) => previous + 1);
      }, 150);
    }

    function onChange(event) {
      const changed = event?.detail?.topics;

      if (
        Array.isArray(changed) &&
        changed.some((topic) => wanted.has(topic))
      ) {
        scheduleRefresh();
      }
    }

    function onVisible() {
      if (
        document.visibilityState === "visible" &&
        Date.now() - lastRefresh >= 10000
      ) {
        scheduleRefresh();
      }
    }

    window.addEventListener("av-realtime-change", onChange);

    let fallback = null;

    if (needsBackup) {
      document.addEventListener("visibilitychange", onVisible);

      window.addEventListener("focus", onVisible);
      window.addEventListener("online", onVisible);

      fallback = window.setInterval(() => {
        if (
          document.visibilityState === "visible" &&
          Date.now() - lastRefresh >= 30000
        ) {
          scheduleRefresh();
        }
      }, 30000);
    }

    return () => {
      window.removeEventListener("av-realtime-change", onChange);

      document.removeEventListener("visibilitychange", onVisible);

      window.removeEventListener("focus", onVisible);
      window.removeEventListener("online", onVisible);

      if (fallback !== null) {
        window.clearInterval(fallback);
      }

      if (pending !== null) {
        window.clearTimeout(pending);
      }
    };
  }, [topicKey]);
}
