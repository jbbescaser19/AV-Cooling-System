import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

import api from "../../../api/api.js";
import { confirmAction } from "../../utils/confirmAction.jsx";

import AvailabilityPicker from "../scheduling/AvailabilityPicker.jsx";

export default function OrderReschedulePanel({ order, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const lock = useRef(false);

  const original = String(order?.schedule || "").slice(0, 16);

  useEffect(() => {
    setOpen(false);
    setSchedule(original);
    setReason("");
    setError("");
  }, [order?.id, original]);

  const eligible =
    order?.channel === "ONLINE" &&
    ["PENDING", "CONFIRMED", "SCHEDULED"].includes(order.status) &&
    Boolean(original) &&
    Number(order.workAlreadyStarted || 0) !== 1 &&
    Number(order.outForDelivery || 0) !== 1;

  const ready = Boolean(
    schedule && schedule !== original && reason.trim().length >= 5,
  );

  async function save(event) {
    event.preventDefault();

    if (!eligible || !ready || lock.current) {
      return;
    }

    lock.current = true;

    setBusy(true);
    setError("");

    try {
      const confirmed = await confirmAction({
        title: "Reschedule order",

        message:
          `Move ${order.reference} to ` +
          `${schedule.replace("T", " at ")} (PH time)? ` +
          "The customer and linked appointment will be updated.",

        confirmText: "Confirm reschedule",
      });

      if (!confirmed) return;

      const { data } = await api.post(
        `/api/management/orders/${encodeURIComponent(order.orderNumber)}/events`,
        {
          requestKey: crypto.randomUUID(),
          eventCode: "SCHEDULE_CHANGED",
          schedule,
          note: reason.trim(),
          internalNote: "",
          technicianIds: [],
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Reschedule was not saved.");
      }

      setOpen(false);
      setReason("");

      onUpdated?.();

      window.dispatchEvent(new Event("av-management-updated"));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not reschedule the order.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!eligible) return null;

  return (
    <section className="sales-step" aria-label="Order appointment">
      <h3>Appointment</h3>

      <p>
        Current schedule:{" "}
        <strong>{original.replace("T", " at ")} (PH time)</strong>
      </p>

      {!open ? (
        <button
          type="button"
          className="wsm-secondary"
          onClick={() => {
            setSchedule(original);
            setOpen(true);
          }}
        >
          <CalendarDays size={16} aria-hidden="true" />
          Reschedule
        </button>
      ) : (
        <form className="wsm-form" onSubmit={save}>
          <AvailabilityPicker
            value={schedule}
            onChange={setSchedule}
            disabled={busy}
            allowExistingValue
            existingValue={original}
            label="Choose a new available appointment"
          />

          <label className="wsm-field">
            Reason for rescheduling
            <textarea
              required
              minLength={5}
              maxLength={1000}
              rows={2}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          {error && (
            <p className="sales-error" role="alert">
              {error}
            </p>
          )}

          <div className="sales-modal-actions">
            <button
              type="button"
              className="wsm-secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false);
                setError("");
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="wsm-primary"
              disabled={!ready || busy}
            >
              {busy ? "Saving…" : "Confirm reschedule"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
