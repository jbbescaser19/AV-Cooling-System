import { Link } from "react-router-dom";
import { Calculator } from "lucide-react";
import HeatLoadEstimator from "../../components/common/HeatLoadEstimator.jsx";
import "../../styles/shared/capacity-calculator-page.css";

export default function CustomerCapacityCalculatorPage() {
  return (
    <section className="customer-module capacity-page capacity-page--customer">
      <header className="capacity-page__header">
        <span className="capacity-page__eyebrow">
          <Calculator size={18} /> SHOPPING GUIDE
        </span>
        <h1>Aircon Capacity Calculator</h1>
        <p>
          Check the approximate HP size your room may need before buying an
          aircon.
        </p>
      </header>
      <HeatLoadEstimator />
      <p className="capacity-page__footer">
        Ready to compare models? <Link to="/shop">Browse air conditioners</Link>
      </p>
    </section>
  );
}
