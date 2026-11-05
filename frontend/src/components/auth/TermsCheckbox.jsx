import { useId, useRef } from "react";
import { ShieldCheck, FileText, ChevronRight, X } from "lucide-react";

import "../../styles/auth/terms-checkbox.css";

const termsSections = [
  {
    title: "1. Account registration",
    description:
      "You agree to provide accurate and updated information when creating your AV Cooling System account. You are responsible for protecting your login credentials.",
  },
  {
    title: "2. Service requests",
    description:
      "Submitting a service request does not automatically confirm an appointment. Requested schedules are subject to technician availability and confirmation.",
  },
  {
    title: "3. Pricing and payments",
    description:
      "Displayed service prices may be estimates. Final charges depend on the services required, and additional work or charges must be disclosed for customer approval.",
  },
  {
    title: "4. Customer responsibilities",
    description:
      "You agree to provide accurate contact details, service addresses, and descriptions of your air conditioning concerns.",
  },
  {
    title: "5. Cancellations",
    description:
      "Customers may request cancellations or schedule changes. Availability and any disclosed cancellation conditions will apply, subject to applicable law.",
  },
  {
    title: "6. Privacy and security",
    description:
      "Personal information is processed for account administration, service coordination, and customer support in accordance with applicable privacy laws and the company's Privacy Notice.",
  },
];

export default function TermsCheckbox({ checked, onChange, disabled = false }) {
  const checkboxId = useId();
  const modalTitleId = useId();
  const modalDescriptionId = useId();

  const dialogRef = useRef(null);

  function openTerms() {
    const dialog = dialogRef.current;

    if (dialog && !dialog.open) {
      dialog.showModal();
    }
  }

  function closeTerms() {
    dialogRef.current?.close();
  }

  return (
    <>
      <section className="terms-consent" aria-label="Account agreement">
        <div className="terms-consent__header">
          <span className="terms-consent__icon" aria-hidden="true">
            <ShieldCheck size={22} />
          </span>

          <div className="terms-consent__heading">
            <h2>Account agreement</h2>

            <p>One last step before creating your account.</p>
          </div>
        </div>

        <label className="terms-consent__accept" htmlFor={checkboxId}>
          <input
            id={checkboxId}
            className="terms-consent__checkbox"
            type="checkbox"
            name="acceptTerms"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
            required
            disabled={disabled}
          />

          <span className="terms-consent__accept-text">
            I have read and agree to the <strong>Terms and Conditions</strong>{" "}
            of AV Cooling System.
          </span>
        </label>

        <button
          className="terms-consent__read"
          type="button"
          onClick={openTerms}
        >
          <span className="terms-consent__read-label">
            <FileText size={17} aria-hidden="true" />
            Read Terms and Conditions
          </span>

          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </section>

      <dialog
        ref={dialogRef}
        className="terms-dialog"
        aria-labelledby={modalTitleId}
        aria-describedby={modalDescriptionId}
      >
        <div className="terms-dialog__handle" aria-hidden="true" />

        <div className="terms-dialog__header">
          <div className="terms-dialog__title-group">
            <span className="terms-dialog__eyebrow">AV COOLING SYSTEM</span>

            <h2 id={modalTitleId}>Terms and Conditions</h2>

            <p id={modalDescriptionId}>
              Please review these account and service conditions.
            </p>
          </div>

          <button
            className="terms-dialog__close"
            type="button"
            onClick={closeTerms}
            aria-label="Close Terms and Conditions"
          >
            <X size={20} />
          </button>
        </div>

        <div className="terms-dialog__body">
          <div className="terms-dialog__intro">
            <ShieldCheck size={20} aria-hidden="true" />

            <p>
              AV Cooling System is committed to transparent service requests,
              responsible account use, and customer communication.
            </p>
          </div>

          <div className="terms-dialog__sections">
            {termsSections.map((section) => (
              <section className="terms-dialog__section" key={section.title}>
                <h3>{section.title}</h3>

                <p>{section.description}</p>
              </section>
            ))}
          </div>

          <p className="terms-dialog__notice">
            These are draft summary terms. The finalized Terms and Conditions
            and Privacy Notice should be available before the website is
            launched publicly.
          </p>
        </div>

        <div className="terms-dialog__footer">
          <button
            className="terms-dialog__done"
            type="button"
            onClick={closeTerms}
          >
            Back to registration
          </button>
        </div>
      </dialog>
    </>
  );
}
