import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

/** The browser return is NEVER proof of payment: only the signed webhook is. */
export default function PaymentReturnPage() {
  return (
    <section className="page-shell">
      <div className="container" style={{ maxWidth: 650 }}>
        <div
          className="surface"
          style={{ padding: 24, display: "grid", gap: 16 }}
        >
          <ShieldCheck size={30} color="#087b98" aria-hidden="true" />
          <h1>Payment status is being checked</h1>
          <p>
            Thank you. If you completed the payment, PayMongo will notify AV
            Cooling securely. Your payment changes to <strong>PAID</strong> only
            after that notification is verified.
          </p>
          <p>
            If you cancelled or payment failed, no completed payment is assumed.
            Avoid paying twice: check the payment record or contact the store
            first.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-dark" to="/account/payments">
              Check My Payments
            </Link>
            <Link className="btn btn-soft" to="/">
              Return Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
