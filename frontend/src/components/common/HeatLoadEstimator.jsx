import { useMemo, useState } from "react";
import {
  estimateHeatLoad,
  recommendAirconSize,
  WORKSHEET_CAPACITIES,
} from "../../utils/heatLoadEstimate.js";
import useCatalogHPAvailability from "../../hooks/useCatalogHPAvailability.js";
import "../../styles/shared/heat-load-estimator.css";
import "../../styles/shared/heat-load-worksheet.css";

const fmt = (value) =>
  Number(value || 0).toLocaleString("en-PH", { maximumFractionDigits: 1 });
const fields = [
  ["occupants", "People normally inside", 0, 200],
  ["glassPanels", "4 × 4-ft window/glass panels", 0, 200],
  ["sunExposures", "Sunlight exposure units (worksheet count)", 0, 200],
  ["computers", "Computer sets", 0, 200],
  ["tvs", "TV / Plasma / LCD sets", 0, 200],
  ["lightingUnits", "Lighting units (worksheet count)", 0, 1000],
  ["refrigerators", "Refrigerators", 0, 100],
  ["kitchenUnits", "Working kitchens", 0, 50],
];

export default function HeatLoadEstimator({ compact = false }) {
  const { options, status, refresh } = useCatalogHPAvailability();
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({
    area: "20",
    usage: "RESIDENTIAL",
    occupants: "2",
    ceilingFeet: "8",
    glassPanels: "0",
    sunExposures: "0",
    computers: "0",
    tvs: "0",
    lightingUnits: "0",
    refrigerators: "0",
    kitchenUnits: "0",
    otherHeatKJHR: "0",
  });
  const set = (key, value) =>
    setForm((previous) => ({ ...previous, [key]: value }));
  const result = useMemo(() => estimateHeatLoad(form), [form]);
  const recommendation = useMemo(
    () =>
      result && status === "ready"
        ? recommendAirconSize(result.totalBTU, options)
        : null,
    [result, options, status],
  );
  const unratedOptions = options.filter((option) => !option.nominalBTU);
  const body = (
    <div className="heat-estimator__body worksheet-estimator">
      <p className="heat-estimator__intro">
        Worksheet method: add the loads in kJ/hr, then compare with available
        aircon sizes. This is an estimate, not a professional cooling-load
        assessment.
      </p>
      <div className="heat-estimator__fields">
        <label>
          Room type
          <select
            value={form.usage}
            onChange={(ev) => set("usage", ev.target.value)}
          >
            <option value="RESIDENTIAL">Residential · 600 kJ/hr per m²</option>
            <option value="COMMERCIAL">Commercial · 800 kJ/hr per m²</option>
          </select>
        </label>
        <label>
          Room area (square meters)
          <input
            type="number"
            required
            min="1"
            max="1000"
            step="0.5"
            value={form.area}
            onChange={(ev) => set("area", ev.target.value)}
          />
        </label>
        <label>
          Ceiling height (feet)
          <input
            type="number"
            required
            min="6"
            max="30"
            step="0.5"
            value={form.ceilingFeet}
            onChange={(ev) => set("ceilingFeet", ev.target.value)}
          />
        </label>
        {fields.map(([key, label, min, max]) => (
          <label key={key}>
            {label}
            <input
              type="number"
              required
              min={min}
              max={max}
              step="1"
              value={form[key]}
              onChange={(ev) => set(key, ev.target.value)}
            />
          </label>
        ))}
        <label>
          Other heat load (kJ/hr)
          <input
            type="number"
            required
            min="0"
            max="1000000"
            step="1"
            value={form.otherHeatKJHR}
            onChange={(ev) => set("otherHeatKJHR", ev.target.value)}
          />
        </label>
      </div>
      <p className="heat-estimator__help">
        The source worksheet does not define what counts as one sunlight or
        lighting unit. These fields follow its multiplication factors exactly;
        ask a technician to interpret them before purchase. Ceilings above 10
        feet add 10%.
      </p>
      {result ? (
        <section
          className="heat-estimator__result worksheet-estimator__result"
          role="status"
          aria-label="Heat-load result"
        >
          <div>
            <span>Total estimated heat load</span>
            <strong>{fmt(result.totalKJHR)} kJ/hr</strong>
          </div>
          <div>
            <span>Equivalent cooling demand</span>
            <strong>{fmt(result.totalBTU)} BTU/hr</strong>
          </div>
          <div>
            <span>Suggested AV Cooling capacity</span>
            <strong className="heat-estimator__hp">
              {status === "loading"
                ? "Checking catalog…"
                : status === "error"
                  ? "Catalog unavailable"
                  : recommendation?.label || "Ask for a rated-capacity check"}
            </strong>
          </div>
          <div>
            <span>Currently offered HP sizes</span>
            <strong>
              {status === "ready"
                ? options.map((item) => item.label).join(", ") || "None active"
                : "—"}
            </strong>
          </div>
          {recommendation && (
            <p className="heat-estimator__result-note">
              Example output: {fmt(recommendation.nominalBTU)} BTU/hr across{" "}
              {recommendation.unitCount} unit(s).
              {recommendation.stockShortage > 0 &&
                ` Inventory shortage: ${recommendation.stockShortage} unit(s).`}
              Actual rated capacity depends on the product model.
            </p>
          )}
          {unratedOptions.length > 0 && (
            <p className="heat-estimator__result-note">
              Offered but not automatically sized:{" "}
              {unratedOptions.map((item) => item.label).join(", ")}. The
              worksheet does not specify cooling output for these sizes
              (including 0.8 HP); the manufacturer rating is needed before
              recommending them.
            </p>
          )}
          {status === "error" && (
            <button type="button" onClick={refresh}>
              Retry active catalog
            </button>
          )}
          <div className="worksheet-estimator__breakdown">
            <h3>Worksheet breakdown (kJ/hr)</h3>
            <div className="worksheet-estimator__scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Quantity</th>
                    <th>× Factor</th>
                    <th>Heat load</th>
                  </tr>
                </thead>
                <tbody>
                  {result.breakdown.map((row) => (
                    <tr key={row.label}>
                      <td>{row.label}</td>
                      <td>{fmt(row.count)}</td>
                      <td>{fmt(row.rate)}</td>
                      <td>{fmt(row.load)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>
                      Ceiling adjustment ({result.heightPercent}%)
                    </th>
                    <td>{fmt(result.heightAdjustmentKJHR)}</td>
                  </tr>
                  <tr>
                    <th colSpan={3}>Total</th>
                    <td>{fmt(result.totalKJHR)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>
      ) : (
        <p className="heat-estimator__error" role="alert">
          Enter valid nonnegative values in the worksheet fields.
        </p>
      )}
      <details className="worksheet-estimator__reference">
        <summary>Show worksheet HP / TR equivalent table</summary>
        <div className="worksheet-estimator__scroll">
          <table>
            <thead>
              <tr>
                <th>Size</th>
                <th>Worksheet kJ/hr</th>
                <th>Approx. BTU/hr</th>
              </tr>
            </thead>
            <tbody>
              {WORKSHEET_CAPACITIES.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{fmt(row.kJhr)}</td>
                  <td>{fmt(Math.round(row.kJhr / 1.05505585262))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="heat-estimator__disclaimer">
        <strong>Planning estimate only.</strong> Actual cooling needs also
        depend on roof heat, insulation, humidity, ventilation, orientation and
        manufacturer cooling-capacity ratings. A technician must verify the
        final selection before installation.
      </p>
    </div>
  );

  if (compact)
    return (
      <details
        className="heat-estimator heat-estimator--compact"
        onToggle={(ev) => setExpanded(ev.currentTarget.open)}
      >
        <summary>
          Calculate room aircon capacity
          <span className="heat-estimator__action">
            {expanded ? "Close calculator" : "Open calculator"}
          </span>
        </summary>
        {body}
      </details>
    );
  return (
    <section
      className="heat-estimator"
      aria-label="AV Cooling worksheet capacity calculator"
    >
      {body}
    </section>
  );
}
