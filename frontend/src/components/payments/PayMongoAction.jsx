import { useState } from "react";
import { CreditCard, Copy, ExternalLink } from "lucide-react";
import api from "../../../api/api.js";

/** Reused by customer orders, service requests, POS, and Facebook sales. */
export default function PayMongoAction({ kind, identifier, staff = false }) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function getLink() {
    if (busy || !identifier) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const endpoint = staff
        ? "/api/management/paymongo/checkout"
        : "/api/customer/paymongo/checkout";
      const { data } = await api.post(endpoint, { kind, identifier });
      const url = new URL(data?.url);
      if (
        !data?.success ||
        url.protocol !== "https:" ||
        url.hostname !== "checkout.paymongo.com"
      ) {
        throw new Error(
          "The payment provider returned an unexpected checkout link.",
        );
      }
      setLink(url.href);
      if (!staff) window.location.assign(url.href);
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "Could not create the payment link.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setNotice("Secure link copied. Send it only to the intended customer.");
    } catch {
      setError(
        "Could not copy automatically. Open the link and copy its address instead.",
      );
    }
  }

  return (
    <div className="paymongo-action">
      <button
        type="button"
        className="btn btn-dark"
        onClick={getLink}
        disabled={busy || !identifier}
      >
        <CreditCard size={16} aria-hidden="true" />{" "}
        {busy
          ? "Preparing secure link…"
          : staff
            ? "Generate PayMongo link"
            : "Pay securely with PayMongo"}
      </button>
      {staff && link && (
        <div className="paymongo-action__share">
          <a href={link} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={15} /> Open secure checkout
          </a>
          <button type="button" className="btn btn-soft" onClick={copyLink}>
            <Copy size={15} /> Copy link for customer
          </button>
        </div>
      )}
      {error && (
        <small className="paymongo-action__error" role="alert">
          {error}
        </small>
      )}
      {notice && <small role="status">{notice}</small>}
      <small>
        GCash / participating bank apps are handled by PayMongo. Never request a
        PIN or OTP. Payment stays pending until verified by PayMongo.
      </small>
    </div>
  );
}
