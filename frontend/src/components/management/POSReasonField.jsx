import { useEffect, useState } from "react";

const OPTIONS = {
  discount: [
    "Promotional discount",
    "Returning customer",
    "Bundle discount",
    "Agreed price adjustment",
    "Customer service adjustment",
  ],

  fee: [
    "Extra travel / delivery",
    "Extra installation materials",
    "Special handling",
    "Additional agreed work",
    "Remote delivery quotation",
  ],
};

export default function POSReasonField({
  kind,
  value = "",
  onChange,
  disabled = false,
}) {
  const options = OPTIONS[kind];

  const [choice, setChoice] = useState(() =>
    options.includes(value) ? value : value ? "OTHER" : "",
  );

  useEffect(() => {
    if (value && options.includes(value)) {
      setChoice(value);
    } else if (value) {
      setChoice("OTHER");
    }
  }, [value, options]);

  const label =
    kind === "discount" ? "Discount reason" : "Additional fee reason";

  return (
    <div className="pos-reason-field">
      <label>
        {label} (required)
        <select
          required
          value={choice}
          disabled={disabled}
          onChange={(e) => {
            setChoice(e.target.value);

            onChange(e.target.value === "OTHER" ? "" : e.target.value);
          }}
        >
          <option value="">Select a reason</option>

          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}

          <option value="OTHER">Other — enter reason</option>
        </select>
      </label>

      {choice === "OTHER" && (
        <label>
          Other reason
          <input
            type="text"
            required
            minLength={5}
            maxLength={255}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      )}
    </div>
  );
}
