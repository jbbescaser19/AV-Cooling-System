import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { AlertCircle, X } from "lucide-react";

export default function GlobalActionError() {
  const [notice, setNotice] = useState(null);

  const location = useLocation();

  useEffect(() => {
    setNotice(null);
  }, [location.pathname]);

  useEffect(() => {
    function handleError(event) {
      const detail = event.detail;

      if (
        !detail ||
        typeof detail.message !== "string" ||
        !detail.message.trim()
      ) {
        return;
      }

      setNotice({
        title: detail.title || "Action not completed",
        message: detail.message,
      });
    }

    window.addEventListener("av-action-error", handleError);

    return () => {
      window.removeEventListener("av-action-error", handleError);
    };
  }, []);

  if (!notice) return null;

  return createPortal(
    <aside
      className="av-global-action-error"
      aria-label="Action error notification"
    >
      <AlertCircle
        className="av-global-action-error__icon"
        size={23}
        aria-hidden="true"
      />

      <div
        className="av-global-action-error__content"
        role="alert"
        aria-atomic="true"
      >
        <strong>{notice.title}</strong>

        <p>{notice.message}</p>
      </div>

      <button
        type="button"
        className="av-global-action-error__close"
        aria-label="Dismiss error message"
        onClick={() => setNotice(null)}
      >
        <X size={19} aria-hidden="true" />
      </button>
    </aside>,
    document.body,
  );
}
