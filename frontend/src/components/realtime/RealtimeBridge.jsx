import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import api from "../../../api/api.js";

/**
 * Keep a single SSE connection for the currently viewed area.
 * Private data is never sent over SSE; topics only ask existing pages
 * to refetch through their authorized HTTP endpoints.
 */
export default function RealtimeBridge() {
  const { pathname } = useLocation();
  const audience = pathname.startsWith("/account")
    ? "customer"
    : pathname.startsWith("/management") &&
        !pathname.startsWith("/management/login")
      ? "staff"
      : "public";

  useEffect(() => {
    if (typeof EventSource === "undefined") return undefined;

    let active = true;
    let connection = null;
    let reconnectTimer = null;
    let connecting = false;
    let retryCount = 0;

    const base = String(api.defaults.baseURL || "").replace(/\/$/, "");
    const sessionEndpoint =
      audience === "customer"
        ? "/api/auth/customer/session"
        : "/api/management/auth/session";

    function onChange(message) {
      let payload;
      try {
        payload = JSON.parse(message.data);
      } catch {
        return;
      }

      const topics = Array.isArray(payload?.topics)
        ? payload.topics.filter((topic) => typeof topic === "string")
        : [];

      if (!topics.length) return;

      window.dispatchEvent(
        new CustomEvent("av-realtime-change", {
          detail: { topics },
        }),
      );

      if (audience === "staff" && topics.includes("notifications")) {
        window.dispatchEvent(new Event("av-management-updated"));
      }

      if (audience === "customer" && topics.includes("notifications")) {
        window.dispatchEvent(new Event("av-notifications-changed"));
      }
    }

    function scheduleReconnect() {
      if (!active || reconnectTimer !== null) return;
      const delay = Math.min(30000, 1500 * 2 ** Math.min(retryCount++, 4));
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, delay);
    }

    async function connect() {
      if (!active || connecting || connection) return;
      connecting = true;

      try {
        // EventSource bypasses Axios refresh interceptors. Checking the
        // session first gives the existing interceptor an opportunity to
        // refresh an expired 15-minute access cookie with the 7-day cookie.
        if (audience !== "public") {
          await api.get(sessionEndpoint);
        }

        if (!active) return;

        connection = new EventSource(`${base}/api/realtime/${audience}`, {
          withCredentials: true,
        });

        connection.addEventListener("change", onChange);
        connection.addEventListener("open", () => {
          retryCount = 0;
        });
        connection.addEventListener("error", () => {
          // A 401 can stop native EventSource from reconnecting.
          // Recreate the stream only after validating the session again.
          connection?.close();
          connection = null;
          scheduleReconnect();
        });
      } catch (error) {
        if (!active) return;
        if ([401, 403].includes(error.response?.status)) {
          // The protected route handles the expired or invalid session.
          // Do not keep making requests against a signed-out account.
          return;
        }
        scheduleReconnect();
      } finally {
        connecting = false;
      }
    }

    void connect();

    return () => {
      active = false;
      connection?.close();
      connection = null;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
    };
  }, [audience]);

  return null;
}
