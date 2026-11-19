import { useRef } from "react";
import { Trash2 } from "lucide-react";

import api from "../../../api/api.js";
import { getStaff } from "../../utils/authMock.js";
import { confirmAction } from "../../utils/confirmAction.jsx";

export default function PermanentArchiveDelete({
  entry,
  busy,
  setBusy,
  onDeleted,
  onError,
}) {
  const locked = useRef(false);

  if (getStaff()?.role !== "OWNER") {
    return null;
  }

  async function remove() {
    if (busy || locked.current) return;

    locked.current = true;
    setBusy(entry.id);

    try {
      const approved = await confirmAction({
        title: "Permanently delete archived record?",
        message: `${entry.label} will be removed from the Archive and cannot be restored. Linked business history is protected. Continue?`,
        confirmText: "Permanently delete",
        danger: true,
      });

      if (!approved) return;

      const { data } = await api.delete(
        `/api/management/workspace/archive/${encodeURIComponent(entry.id)}`,
        {
          data: {
            confirm: true,
          },
        },
      );

      if (!data.success) {
        throw new Error("Deletion was not confirmed.");
      }

      onDeleted(data.message);

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      onError(
        err.response?.data?.message ||
          err.message ||
          "Unable to permanently delete this record.",
      );
    } finally {
      setBusy("");
      locked.current = false;
    }
  }

  return (
    <button
      type="button"
      disabled={Boolean(busy)}
      onClick={remove}
      style={{
        background: "#dc2626",
        color: "#ffffff",
        border: "1px solid #dc2626",
        boxShadow: "none",
        opacity: busy ? 0.6 : 1,
        cursor: busy ? "not-allowed" : "pointer",
      }}
    >
      <Trash2 size={16} />
      Permanent Delete
    </button>
  );
}
