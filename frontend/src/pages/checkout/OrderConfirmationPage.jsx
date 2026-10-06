import { useParams, Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import "../../styles/ecommerce/pages.css";

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  return (
    <section className="page-shell">
      <div className="container">
        <div className="surface confirmation-card">
          <CheckCircle2 size={56} />
          <h1>Order received</h1>
          <p className="muted">Mock order <b>{orderId}</b> has been created.</p>
          <Link className="btn btn-dark" to="/account/orders">View My Orders</Link>
        </div>
      </div>
    </section>
  );
}
