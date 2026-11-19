import {
  DELIVERY_AREAS,
  displayedDeliveryFee,
  completeDeliveryAddress,
  deliveryAddressConflict,
} from "../../utils/deliveryPricing.js";

const money = (amount) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
  }).format(amount);

export function prepareFacebookDelivery(form, isNew) {
  const area = form.deliveryArea;

  const address = String(
    isNew ? form.address || "" : form.deliveryAddress || "",
  ).trim();

  if (!area) {
    throw new Error("Select a delivery area.");
  }

  if (address.length < 5) {
    throw new Error("Enter the complete delivery address.");
  }

  if (area === "OTHER") {
    const fee = Number(form.customDeliveryFee);

    const reason = String(form.deliveryFeeReason || "").trim();

    if (address.length < 10) {
      throw new Error("Enter the complete remote delivery address.");
    }

    if (
      !Number.isFinite(fee) ||
      fee <= 0 ||
      fee > 99999.99 ||
      Math.abs(fee * 100 - Math.round(fee * 100)) > 0.000001
    ) {
      throw new Error("Enter a valid custom delivery fee.");
    }

    if (reason.length < 5 || reason.length > 255) {
      throw new Error("Enter a reason for the custom delivery fee.");
    }

    return {
      deliveryArea: area,
      customDeliveryFee: fee,
      deliveryFeeReason: reason,

      ...(isNew ? { address } : { deliveryAddress: address }),
    };
  }

  if (displayedDeliveryFee(area) === null) {
    throw new Error("Select a valid delivery area.");
  }

  const conflict = deliveryAddressConflict(address, area);

  if (conflict) {
    throw new Error(conflict);
  }

  const completedAddress = completeDeliveryAddress(address, area);

  return {
    deliveryArea: area,

    ...(isNew
      ? { address: completedAddress }
      : { deliveryAddress: completedAddress }),
  };
}

export default function FacebookDeliveryFields({
  form,
  onChange,
  isNew,
  disabled = false,
}) {
  const area = form.deliveryArea || "";

  const remote = area === "OTHER";

  const address = isNew ? form.address || "" : form.deliveryAddress || "";

  const fee = remote
    ? Number(form.customDeliveryFee) || 0
    : displayedDeliveryFee(area);

  const conflict =
    !remote && area ? deliveryAddressConflict(address, area) : "";

  const completedAddress =
    !remote && area && !conflict
      ? completeDeliveryAddress(address, area)
      : address;

  return (
    <fieldset
      className="wsm-form"
      disabled={disabled}
      style={{
        display: "grid",
        gap: "12px",
        minWidth: 0,
        margin: 0,
        padding: "12px",
        border: "1px solid #d8e5ec",
        borderRadius: "10px",
      }}
    >
      <legend
        style={{
          padding: "0 6px",
          fontSize: "0.88rem",
          fontWeight: 700,
        }}
      >
        Delivery details
      </legend>

      <label className="wsm-field">
        Delivery area *
        <select
          required
          value={area}
          onChange={(event) => onChange("deliveryArea", event.target.value)}
        >
          <option value="">Select delivery area</option>

          {DELIVERY_AREAS.map(([code, label, amount]) => (
            <option key={code} value={code}>
              {label} — {amount === 0 ? "Free delivery" : money(amount)}
            </option>
          ))}

          <option value="OTHER">Other location — Custom fee</option>
        </select>
      </label>

      {!isNew && (
        <label className="wsm-field">
          Complete delivery address *
          <textarea
            rows={2}
            required
            minLength={5}
            maxLength={2000}
            value={address}
            placeholder="House number, street, barangay, city and province"
            onChange={(event) =>
              onChange("deliveryAddress", event.target.value)
            }
          />
        </label>
      )}

      {remote && (
        <>
          <label className="wsm-field">
            Agreed delivery fee (₱) *
            <input
              type="number"
              required
              min={0.01}
              max={99999.99}
              step={0.01}
              value={form.customDeliveryFee ?? ""}
              placeholder="Enter delivery fee"
              onChange={(event) =>
                onChange("customDeliveryFee", event.target.value)
              }
            />
          </label>

          <label className="wsm-field">
            Delivery fee reason *
            <textarea
              required
              minLength={5}
              maxLength={255}
              rows={2}
              value={form.deliveryFeeReason || ""}
              placeholder="Example: Delivery outside the regular service area"
              onChange={(event) =>
                onChange("deliveryFeeReason", event.target.value)
              }
            />
          </label>
        </>
      )}

      {conflict && (
        <p className="wsm-error" role="alert">
          {conflict}
        </p>
      )}

      {area && completedAddress && !conflict && (
        <small
          style={{
            overflowWrap: "anywhere",
            lineHeight: 1.5,
          }}
        >
          Delivery destination: {completedAddress}
        </small>
      )}

      {fee !== null && (
        <div className="wsm-stock-preview">
          <span>Delivery fee</span>

          <strong>{fee === 0 ? "Free delivery" : money(fee)}</strong>
        </div>
      )}

      <small>
        Verify the delivery destination and agreed fee before saving.
      </small>
    </fieldset>
  );
}
