import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock3 } from "lucide-react";
import api from "../../../api/api.js";
import "../../styles/management/management-session.css";

const IDLE_MS = 15 * 60 * 1000;
const WARNING_MS = 2 * 60 * 1000;
const HEARTBEAT_GAP_MS = 45 * 1000;

function formatRemaining(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function ManagementSessionGuard({
  session,
  onActivity,
  onExpired,
  children,
}) {
  const [idleExpiresAt, setIdleExpiresAt] = useState(session.idleExpiresAt);
  const [now, setNow] = useState(Date.now());
  const [sending, setSending] = useState(false);
  const idleRef = useRef(session.idleExpiresAt);
  const absoluteRef = useRef(session.absoluteExpiresAt);
  const lastHeartbeatRef = useRef(session.idleExpiresAt - IDLE_MS);
  const latestInputRef = useRef(0);
  const activeRequestRef = useRef(false);
  const triggerHeartbeatRef = useRef(null);
  const expiredRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  const onActivityRef = useRef(onActivity);

  useEffect(() => {
    onExpiredRef.current = onExpired;
  }, [onExpired]);
  useEffect(() => {
    onActivityRef.current = onActivity;
  }, [onActivity]);

  useEffect(() => {
    idleRef.current = session.idleExpiresAt;
    absoluteRef.current = session.absoluteExpiresAt;
    lastHeartbeatRef.current = session.idleExpiresAt - IDLE_MS;
    setIdleExpiresAt(session.idleExpiresAt);
  }, [session.id, session.idleExpiresAt, session.absoluteExpiresAt]);

  useEffect(() => {
    function expire() {
      if (expiredRef.current) return;
      expiredRef.current = true;
      onExpiredRef.current();
    }

    async function heartbeat() {
      if (activeRequestRef.current || expiredRef.current) return;
      const current = Date.now();
      if (current >= Math.min(idleRef.current, absoluteRef.current)) {
        expire();
        return;
      }
      activeRequestRef.current = true;
      setSending(true);
      try {
        const { data } = await api.post("/api/management/auth/activity", {});
        if (data.success && data.session?.idleExpiresAt) {
          idleRef.current = data.session.idleExpiresAt;
          absoluteRef.current = data.session.absoluteExpiresAt;
          lastHeartbeatRef.current = Date.now();
          setIdleExpiresAt(data.session.idleExpiresAt);
          onActivityRef.current(data.session);
        }
      } catch (error) {
        if (error.response?.status === 401) expire();
      } finally {
        activeRequestRef.current = false;
        setSending(false);
      }
    }

    triggerHeartbeatRef.current = heartbeat;

    function registerInput() {
      if (document.visibilityState === "hidden") return;
      latestInputRef.current = Date.now();
      if (
        latestInputRef.current - lastHeartbeatRef.current >=
        HEARTBEAT_GAP_MS
      ) {
        void heartbeat();
      }
    }

    function checkTime() {
      const current = Date.now();
      setNow(current);
      if (current >= Math.min(idleRef.current, absoluteRef.current)) {
        // Do not interrupt a heartbeat already accepted by the server.
        if (!activeRequestRef.current) expire();
        return;
      }
      if (
        latestInputRef.current > lastHeartbeatRef.current &&
        current - lastHeartbeatRef.current >= HEARTBEAT_GAP_MS
      ) {
        void heartbeat();
      }
    }

    for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) {
      document.addEventListener(event, registerInput, { passive: true });
    }
    window.addEventListener("focus", checkTime);
    document.addEventListener("visibilitychange", checkTime);
    const interval = window.setInterval(checkTime, 1000);
    return () => {
      for (const event of ["pointerdown", "keydown", "touchstart", "wheel"]) {
        document.removeEventListener(event, registerInput);
      }
      window.removeEventListener("focus", checkTime);
      document.removeEventListener("visibilitychange", checkTime);
      window.clearInterval(interval);
      triggerHeartbeatRef.current = null;
    };
  }, [session.id]);

  const remaining = Math.min(idleExpiresAt, session.absoluteExpiresAt) - now;
  const warning = remaining > 0 && remaining <= WARNING_MS;

  return (
    <>
      {children}
      {warning && (
        <div className="mgmt-session-shade" role="presentation">
          <section
            className="mgmt-session-warning"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mgmt-session-warning-title"
            aria-describedby="mgmt-session-warning-description"
          >
            <div className="mgmt-session-icon">
              <AlertTriangle size={23} />
            </div>
            <h2 id="mgmt-session-warning-title">
              Your session is about to end
            </h2>
            <p id="mgmt-session-warning-description">
              Your Management login will expire in{" "}
              <strong>{formatRemaining(remaining)}</strong>. Continue working to
              stay signed in until the 8-hour limit.
            </p>
            <div className="mgmt-session-actions">
              <button
                type="button"
                className="mgmt-session-primary"
                disabled={sending}
                onClick={() => {
                  // A real click is required; no background request renews inactivity.
                  latestInputRef.current = Date.now();
                  void triggerHeartbeatRef.current?.();
                }}
              >
                <Clock3 size={17} />{" "}
                {sending ? "Checking…" : "Continue session"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
