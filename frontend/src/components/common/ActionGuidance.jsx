import { AlertCircle, CheckCircle2 } from "lucide-react";
import "../../styles/shared/action-guidance.css";

/** Reasons are provided by the same conditions that disable each action. */
export default function ActionGuidance({
  title = "Before continuing",
  reasons = [],
  readyText = "All required details are complete.",
}) {
  return (
    <div
      className={`av-action-guidance${reasons.length ? " is-blocked" : " is-ready"}`}
      role="status"
      aria-live="polite"
    >
      <div className="av-action-guidance__heading">
        {reasons.length ? (
          <AlertCircle size={17} aria-hidden="true" />
        ) : (
          <CheckCircle2 size={17} aria-hidden="true" />
        )}
        <strong>{reasons.length ? title : readyText}</strong>
      </div>
      {reasons.length > 0 && (
        <>
          <ul>
            {reasons.slice(0, 3).map((reason, index) => (
              <li key={`${index}-${reason}`}>{reason}</li>
            ))}
          </ul>
          {reasons.length > 3 && (
            <small>
              {reasons.length - 3} more step(s) will appear as you complete
              these.
            </small>
          )}
        </>
      )}
    </div>
  );
}
