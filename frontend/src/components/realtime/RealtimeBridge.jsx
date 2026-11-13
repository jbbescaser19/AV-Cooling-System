import { useEffect } from "react";
import api from "../../../api/api.js";

export default function RealtimeBridge({ audience }) {
  useEffect(() => {
    const audiences = ["public", "customer", "staff"];

    if (!audiences.includes(audience) || typeof EventSource === "undefined") {
      return undefined;
    }

    const baseUrl = (
      import.meta.env.VITE_API_URL || "http://localhost:3000"
    ).replace(/\/$/, "");

    let source = null;
    let reconnectTimer = null;
    let batchTimer = null;
    let stopped = false;
    let failures = 0;

    const pending = new Set();

    function publishPending() {
      if (
        stopped ||
        document.visibilityState === "hidden" ||
        pending.size === 0
      ) {
        return;
      }

      const topics = [...pending];
      pending.clear();

      window.dispatchEvent(
        new CustomEvent("av-realtime-change", {
          detail: { topics },
        }),
      );

      if (audience === "staff") {
        window.dispatchEvent(
          new CustomEvent("av-management-updated", {
            detail: {
              topics,
              realtime: true,
            },
          }),
        );

        if (topics.includes("notifications") || topics.includes("inventory")) {
          window.dispatchEvent(
            new Event("av-management-notifications-changed"),
          );
        }
      }

      if (audience === "customer") {
        window.dispatchEvent(
          new CustomEvent("av-customer-updated", {
            detail: { topics },
          }),
        );

        if (topics.includes("notifications")) {
          window.dispatchEvent(new Event("av-notifications-changed"));
        }
      }

      if (topics.includes("catalog") || topics.includes("inventory")) {
        window.dispatchEvent(new Event("av-catalog-updated"));
      }

      if (topics.includes("schedules")) {
        window.dispatchEvent(new Event("av-schedules-updated"));
      }
    }

    function enqueue(topics) {
      for (const topic of topics) {
        if (typeof topic === "string") {
          pending.add(topic);
        }
      }

      if (!batchTimer) {
        batchTimer = window.setTimeout(() => {
          batchTimer = null;
          publishPending();
        }, 300);
      }
    }

    async function sessionIsValid() {
      if (audience === "public") {
        return true;
      }

      try {
        const endpoint =
          audience === "staff"
            ? "/api/management/auth/session"
            : "/api/auth/customer/session";

        const response = await api.get(endpoint);

        if (
          response.data?.success === false ||
          response.data?.authenticated === false
        ) {
          return false;
        }

        return true;
      } catch (error) {
        if (error.response?.status === 401 || error.response?.status === 403) {
          return false;
        }

        return null;
      }
    }

    function scheduleReconnect() {
      if (stopped || reconnectTimer) {
        return;
      }

      const delay = Math.min(30000, 2000 * 2 ** Math.min(failures++, 4));

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void reconnect();
      }, delay);
    }

    async function reconnect() {
      if (stopped) return;

      if (!navigator.onLine) {
        scheduleReconnect();
        return;
      }

      const valid = await sessionIsValid();

      if (stopped) return;

      if (valid === true) {
        open();
      } else if (valid === null) {
        scheduleReconnect();
      }
    }

    function open() {
      if (stopped) return;

      source?.close();

      source = new EventSource(`${baseUrl}/api/realtime/${audience}`, {
        withCredentials: true,
      });

      source.addEventListener("open", () => {
        failures = 0;
      });

      source.addEventListener("change", (event) => {
        try {
          const data = JSON.parse(event.data);

          if (Array.isArray(data?.topics)) {
            enqueue(data.topics);
          }
        } catch {
          // Ignore malformed events.
        }
      });

      source.onerror = () => {
        source?.close();
        source = null;

        scheduleReconnect();
      };
    }

    function onVisible() {
      if (document.visibilityState !== "visible") {
        return;
      }

      publishPending();

      enqueue(
        audience === "public"
          ? ["catalog", "schedules", "feedback"]
          : [
              "dashboard",
              "orders",
              "services",
              "payments",
              "schedules",
              "jobs",
              "notifications",
              "inventory",
              "catalog",
              "cart",
              "customers",
              "staff",
              "archive",
              "reports",
              "feedback",
            ],
      );

      if (!source && !reconnectTimer) {
        scheduleReconnect();
      }
    }

    function onOnline() {
      if (!source && !reconnectTimer) {
        scheduleReconnect();
      }
    }

    document.addEventListener("visibilitychange", onVisible);

    window.addEventListener("online", onOnline);

    open();

    return () => {
      stopped = true;

      source?.close();

      window.clearTimeout(reconnectTimer);
      window.clearTimeout(batchTimer);

      document.removeEventListener("visibilitychange", onVisible);

      window.removeEventListener("online", onOnline);
    };
  }, [audience]);

  return null;
}
