import { useEffect, useState } from "react";

import { MapPin, Plus } from "lucide-react";

import {
  MAX_SAVED_ADDRESSES,
  addCustomerAddress,
  readCustomerAddresses,
} from "../../utils/addressStore";

import "../../styles/ecommerce/address-selector.css";

export default function SavedAddressSelector({
  value,
  onChange,
  className = "",
  title = "Address",
}) {
  const [addresses, setAddresses] = useState(() => readCustomerAddresses());

  const [adding, setAdding] = useState(
    () => readCustomerAddresses().length === 0,
  );

  const [label, setLabel] = useState("Home");

  const [newAddress, setNewAddress] = useState("");

  const [error, setError] = useState("");

  useEffect(() => {
    const refresh = () => {
      setAddresses(readCustomerAddresses());
    };

    window.addEventListener("av-customer-updated", refresh);

    return () => {
      window.removeEventListener("av-customer-updated", refresh);
    };
  }, []);

  const selected = addresses.find((item) => item.address === value) || null;

  const canAdd = addresses.length < MAX_SAVED_ADDRESSES;

  const saveNewAddress = () => {
    setError("");

    try {
      const result = addCustomerAddress({
        label,
        address: newAddress,
      });

      setAddresses(result.addresses);

      onChange(result.record.address);

      setAdding(false);
      setNewAddress("");
      setLabel("Home");
    } catch (err) {
      setError(err.message || "Unable to save address.");
    }
  };

  return (
    <div className={`address-selector ${className}`}>
      <div className="address-selector-heading">
        <div>
          <strong>{title}</strong>

          <span>
            {addresses.length}/{MAX_SAVED_ADDRESSES} saved
          </span>
        </div>

        <MapPin size={18} />
      </div>

      {addresses.length > 0 && (
        <div className="form-group">
          <label>Select saved address</label>

          <select
            className="form-control"
            value={selected?.id || ""}
            onChange={(event) => {
              const id = event.target.value;

              const address = addresses.find((item) => item.id === id);

              if (address) {
                onChange(address.address);

                setAdding(false);
              }
            }}
          >
            <option value="" disabled>
              Select an address
            </option>

            {addresses.map((item) => (
              <option value={item.id} key={item.id}>
                {item.label}
                {item.default ? " · Default" : ""}
                {" — "}
                {item.address}
              </option>
            ))}
          </select>
        </div>
      )}

      {!adding && canAdd && (
        <button
          type="button"
          className="address-add-button"
          onClick={() => setAdding(true)}
        >
          <Plus size={16} />
          Add new address
        </button>
      )}

      {adding && canAdd && (
        <div className="address-new-form">
          <div className="form-group">
            <label>Address label</label>

            <select
              className="form-control"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            >
              <option>Home</option>
              <option>Office</option>
              <option>Other</option>
            </select>
          </div>

          <div className="form-group">
            <label>Complete address</label>

            <textarea
              className="form-control"
              rows="3"
              value={newAddress}
              onChange={(event) => setNewAddress(event.target.value)}
              placeholder="House/Unit, Street, Barangay, City, Province"
            />
          </div>

          {error && <div className="address-error">{error}</div>}

          <div className="address-new-actions">
            {addresses.length > 0 && (
              <button
                type="button"
                className="btn btn-soft"
                onClick={() => {
                  setAdding(false);
                  setError("");
                }}
              >
                Cancel
              </button>
            )}

            <button
              type="button"
              className="btn btn-dark"
              onClick={saveNewAddress}
            >
              Save & Use Address
            </button>
          </div>
        </div>
      )}

      {!canAdd && (
        <small className="address-limit">
          Maximum of 3 saved addresses reached.
        </small>
      )}
    </div>
  );
}
