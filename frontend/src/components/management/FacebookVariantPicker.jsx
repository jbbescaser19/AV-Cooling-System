import { useState } from "react";

export default function FacebookVariantPicker({
  items,
  value,
  onChange,
  quantity = 1,
  disabled,
}) {
  const selected = items.find((item) => String(item.id) === String(value));

  const [brand, setBrand] = useState(selected?.brand || "");

  const [model, setModel] = useState(selected?.model || "");

  const brands = [
    ...new Set(items.map((item) => item.brand).filter(Boolean)),
  ].sort();

  const models = [
    ...new Set(
      items
        .filter((item) => item.brand === brand)
        .map((item) => item.model)
        .filter(Boolean),
    ),
  ].sort();

  const choices = items.filter(
    (item) => item.brand === brand && item.model === model,
  );

  return (
    <>
      <label className="wsm-field">
        <span>Brand *</span>

        <select
          required
          value={brand}
          disabled={disabled}
          onChange={(event) => {
            setBrand(event.target.value);
            setModel("");
            onChange("");
          }}
        >
          <option value="">Choose brand</option>

          {brands.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="wsm-field">
        <span>Model *</span>

        <select
          required
          value={model}
          disabled={disabled || !brand}
          onChange={(event) => {
            setModel(event.target.value);
            onChange("");
          }}
        >
          <option value="">Choose model</option>

          {models.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label className="wsm-field">
        <span>Horsepower *</span>

        <select
          required
          value={value || ""}
          disabled={disabled || !model}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Choose available HP</option>

          {choices.map((item) => (
            <option
              key={item.id}
              value={item.id}
              disabled={Number(item.available) < quantity}
            >
              {Number(item.horsepower)} HP
              {" — "}
              {Number(item.available)} available
              {Number(item.available) < quantity ? " (insufficient stock)" : ""}
            </option>
          ))}
        </select>

        {items.length === 0 && (
          <small>
            No active product variants returned. Refresh inventory and try
            again.
          </small>
        )}

        {selected && (
          <small>
            {Number(selected.available)} available
            {" · ₱"}
            {Number(selected.price || 0).toLocaleString("en-PH")}
          </small>
        )}
      </label>
    </>
  );
}
