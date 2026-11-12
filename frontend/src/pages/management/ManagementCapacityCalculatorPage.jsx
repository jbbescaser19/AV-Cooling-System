import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";

import HeatLoadEstimator from "../../components/common/HeatLoadEstimator.jsx";

import "../../styles/shared/capacity-calculator-page.css";

export default function ManagementCapacityCalculatorPage() {
  return (
    <section className="capacity-page capacity-page--management">
      <header className="capacity-page__header">
        <span className="capacity-page__eyebrow">
          <Calculator size={18} />
          SALES & CONSULTATION TOOL
        </span>

        <h1>Aircon Capacity Calculator</h1>

        <p>
          Estimate the customer's room cooling needs and discuss a suitable HP
          size before making a sale.
        </p>
      </header>

      <HeatLoadEstimator />

      <p className="capacity-page__footer">
        For confirmed orders, visit <Link to="/management/orders">Orders</Link>.
        The calculated HP is guidance, not an automatic product or price
        selection.
      </p>
    </section>
  );
}
