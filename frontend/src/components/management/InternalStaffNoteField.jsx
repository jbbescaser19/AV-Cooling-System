import { useState } from "react";

const START_REASONS = [
  "Technician has arrived",
  "Service is now in progress",
  "Aircon inspection has started",
];

const COMPLETION_REASONS = [
  "Service completed successfully",
  "Aircon tested and working properly",
  "Maintenance completed",
  "Cleaning completed",
  "Repair completed",
  "Installation completed",
  "Further servicing recommended",
];

const CONFIRMATION_METHODS = [
  "Technician confirmed via phone call",
  "Technician confirmed via Messenger",
  "Technician confirmed in person",
  "Personally verified by management",
];

export function CustomerProgressReasonField({
  event,
  value = "",
  onChange,
  disabled = false,
}) {
  const [choice, setChoice] = useState("");

  const reasons =
    event === "SERVICE_COMPLETED" ? COMPLETION_REASONS : START_REASONS;

  function changeReason(reason) {
    setChoice(reason);

    onChange(reason === "OTHER" ? "" : reason);
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <label className="wsm-field">
        Customer-visible reason (optional)
        <select
          value={choice}
          onChange={(event) => changeReason(event.target.value)}
          disabled={disabled}
        >
          <option value="">No additional message</option>

          {reasons.map((reason) => (
            <option key={reason} value={reason}>
              {reason}
            </option>
          ))}

          <option value="OTHER">Other</option>
        </select>
      </label>

      {choice === "OTHER" && (
        <label className="wsm-field">
          Specify customer message
          <textarea
            rows={2}
            maxLength={1000}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder="Enter custom message"
            disabled={disabled}
            required
          />
        </label>
      )}

      <small>
        This message is shared with the customer. Do not include private staff
        information.
      </small>
    </div>
  );
}

export default function InternalStaffNoteField({
  event,
  value = "",
  onChange,
  disabled = false,
}) {
  const [method, setMethod] = useState("");
  const [details, setDetails] = useState("");

  const isWorkProgress = ["SERVICE_STARTED", "SERVICE_COMPLETED"].includes(
    event,
  );

  const isCompletion = event === "SERVICE_COMPLETED";

  function changeMethod(nextMethod) {
    setMethod(nextMethod);
    setDetails("");
    onChange("");
  }

  function changeDetails(nextDetails) {
    setDetails(nextDetails);

    const cleanDetails = nextDetails.trim();

    if (!method || cleanDetails.length < 10) {
      onChange("");
      return;
    }

    onChange(method === "OTHER" ? cleanDetails : `${method}. ${cleanDetails}`);
  }

  if (!isWorkProgress) {
    return (
      <label className="wsm-field">
        Internal staff note (optional)
        <textarea
          rows={3}
          maxLength={1000}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="For authorized staff only"
          disabled={disabled}
        />
        <small>Private. Not shared with customers.</small>
      </label>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: 10,
        minWidth: 0,
      }}
    >
      <label className="wsm-field">
        Internal staff note (required)
        <select
          value={method}
          onChange={(event) => changeMethod(event.target.value)}
          disabled={disabled}
          required
        >
          <option value="">Select confirmation method</option>

          {CONFIRMATION_METHODS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}

          <option value="OTHER">Other</option>
        </select>
      </label>

      {method && (
        <label className="wsm-field">
          {method === "OTHER"
            ? "Specify confirmation method and details"
            : isCompletion
              ? "Technician name and completion findings"
              : "Technician name and work progress"}

          <textarea
            rows={3}
            minLength={10}
            maxLength={900}
            value={details}
            onChange={(event) => changeDetails(event.target.value)}
            placeholder={
              isCompletion
                ? "Enter technician name and completion findings"
                : "Enter technician name and service progress"
            }
            disabled={disabled}
            required
          />
        </label>
      )}

      <small>
        Private. Not included in customer notifications or customer history.
      </small>
    </div>
  );
}
