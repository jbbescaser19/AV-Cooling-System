import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../../../api/api.js";

import { logoutCustomer } from "../../utils/authMock.js";

import {
  clearPendingAction,
  clearDirectCheckout,
} from "../../utils/purchaseFlow.js";

const PUBLIC_TOPICS = ["catalog", "inventory", "schedules", "feedback"];

const CUSTOMER_TOPICS = [
  ...PUBLIC_TOPICS,
  "orders",
  "services",
  "payments",
  "notifications",
  "cart",
  "customers",
  "jobs",
];

const STAFF_TOPICS = [
  ...CUSTOMER_TOPICS,
  "dashboard",
  "staff",
  "archive",
  "reports",
  "audit",
];

export default function RealtimeBridge() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const navigateRef = useRef(navigate);

  navigateRef.current = navigate;

  const area = pathname.startsWith("/management")
    ? /^\/management\/login(?:\/|$)/.test(pathname)
      ? "public"
      : /^\/management\/change-password(?:\/|$)/.test(pathname)
        ? "staff-password"
        : "staff"
    : /^\/(login|register|forgot-password)(?:\/|$)/.test(pathname)
      ? "public"
      : /^\/(account|checkout|order-confirmation)(?:\/|$)/.test(pathname)
        ? "protected-customer"
        : "storefront";

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return;
    }

    // Do not connect to protected real-time events
    // while the staff password is being changed.
    if (area === "staff-password") {
      return;
    }

    const controller = new AbortController();

    let active = true;

    let audience =
      area === "staff" ? "staff" : area === "public" ? "public" : "customer";

    let authenticatedCustomer = false;

    let connection = null;
    let reconnectTimer = null;
    let sessionTimer = null;
    let checkingSession = null;

    let connecting = false;
    let retryCount = 0;
    let lastId = "";

    const base = String(api.defaults.baseURL || "").replace(/\/$/, "");

    function endCustomerSession() {
      if (!active) return;

      active = false;

      connection?.close();

      connection = null;

      controller.abort();

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      if (sessionTimer !== null) {
        window.clearInterval(sessionTimer);
      }

      logoutCustomer();

      clearPendingAction();
      clearDirectCheckout();

      navigateRef.current("/login", {
        replace: true,

        state: {
          message: "Your session has ended. Please log in again.",
        },
      });
    }

    function checkCustomerSession() {
      if (checkingSession) {
        return checkingSession;
      }

      checkingSession = api
        .get("/api/auth/customer/session-status", {
          signal: controller.signal,
        })
        .then(({ data }) => {
          if (!active) return "stopped";

          if (data?.authenticated === true) {
            authenticatedCustomer = true;

            return "valid";
          }

          if (authenticatedCustomer) {
            endCustomerSession();
          }

          return "invalid";
        })
        .catch((error) => {
          if (!active) return "stopped";

          if ([401, 403].includes(error.response?.status)) {
            if (authenticatedCustomer) {
              endCustomerSession();
            }

            return "invalid";
          }

          // Temporary network errors must not
          // automatically log customers out.
          return "unavailable";
        })
        .finally(() => {
          checkingSession = null;
        });

      return checkingSession;
    }

    function remember(id) {
      if (
        /^\d{1,20}$/.test(id || "") &&
        (!lastId || BigInt(id) > BigInt(lastId))
      ) {
        lastId = id;
      }
    }

    function publish(payload) {
      if (!active) return;

      const topics = Array.isArray(payload?.topics)
        ? payload.topics.filter((topic) => typeof topic === "string")
        : [];

      if (!topics.length) return;

      // Verify the customer session when
      // account information changes.
      if (audience === "customer" && topics.includes("customers")) {
        void checkCustomerSession();
      }

      window.dispatchEvent(
        new CustomEvent("av-realtime-change", {
          detail: {
            topics,
          },
        }),
      );

      if (
        audience === "staff" &&
        topics.some((topic) => ["notifications", "inventory"].includes(topic))
      ) {
        window.dispatchEvent(new Event("av-management-notifications-changed"));

        window.dispatchEvent(new Event("av-management-updated"));
      }

      if (audience === "customer" && topics.includes("notifications")) {
        window.dispatchEvent(new Event("av-notifications-changed"));
      }
    }

    function scheduleReconnect() {
      if (!active || reconnectTimer !== null) {
        return;
      }

      const delay = Math.min(30000, 1500 * 2 ** Math.min(retryCount++, 4));

      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = null;

        void connect();
      }, delay);
    }

    async function connect() {
      if (!active || connecting || connection) {
        return;
      }

      connecting = true;

      try {
        if (audience === "staff") {
          const { data } = await api.get("/api/management/auth/session", {
            signal: controller.signal,
          });

          if (!active) return;

          if (!data?.success || !data?.staff?.role) {
            return;
          }

          // Staff using temporary passwords must
          // change their password before connecting.
          if (data.staff.mustChangePassword) {
            navigateRef.current("/management/change-password", {
              replace: true,
            });

            return;
          }
        } else if (audience === "customer") {
          const result = await checkCustomerSession();

          if (!active || result === "stopped") {
            return;
          }

          if (result === "unavailable") {
            scheduleReconnect();

            return;
          }

          if (result === "invalid") {
            // CustomerRoute handles initial guest
            // access to protected customer pages.
            if (area === "protected-customer") {
              return;
            }

            audience = "public";
            lastId = "";
          } else if (sessionTimer === null) {
            // Backup session validation.
            sessionTimer = window.setInterval(() => {
              void checkCustomerSession();
            }, 15000);
          }
        }

        if (!active) return;

        const needsSnapshot = !lastId;

        const query = lastId
          ? `?lastEventId=${encodeURIComponent(lastId)}`
          : "";

        const next = new EventSource(
          `${base}/api/realtime/${audience}${query}`,
          {
            withCredentials: true,
          },
        );

        connection = next;

        next.addEventListener("change", (event) => {
          if (!active || connection !== next) {
            return;
          }

          remember(event.lastEventId);

          try {
            publish(JSON.parse(event.data));
          } catch {
            // Ignore malformed events.
          }
        });

        next.addEventListener("checkpoint", (event) => {
          if (active && connection === next) {
            remember(event.lastEventId);
          }
        });

        next.addEventListener("reset", (event) => {
          if (!active || connection !== next) {
            return;
          }

          try {
            const data = JSON.parse(event.data);

            lastId = String(data.cursor || "0");

            publish(data);
          } catch {
            // Ignore malformed events.
          }
        });

        next.addEventListener("open", () => {
          if (!active || connection !== next) {
            return;
          }

          retryCount = 0;

          if (needsSnapshot) {
            publish({
              topics:
                audience === "staff"
                  ? STAFF_TOPICS
                  : audience === "customer"
                    ? CUSTOMER_TOPICS
                    : PUBLIC_TOPICS,
            });
          }
        });

        next.addEventListener("error", () => {
          if (!active || connection !== next) {
            return;
          }

          next.close();

          connection = null;

          scheduleReconnect();
        });
      } catch (error) {
        if (!active) return;

        const status = error.response?.status;
        const code = error.response?.data?.code;

        if (audience === "staff" && code === "PASSWORD_CHANGE_REQUIRED") {
          navigateRef.current("/management/change-password", {
            replace: true,
          });

          return;
        }

        // Do not repeatedly retry unauthorized requests.
        if ([401, 403].includes(status)) {
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

      controller.abort();

      connection?.close();

      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
      }

      if (sessionTimer !== null) {
        window.clearInterval(sessionTimer);
      }
    };
  }, [area]);

  return null;
}
