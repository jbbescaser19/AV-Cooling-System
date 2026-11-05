import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import api from "../../../api/api.js";

export default function SavedAddressSelector({
  title = "Service address",
  value = "",
  onChange,
  className = "",
  disabled = false,
}) {
  const navigate = useNavigate();

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const currentValue = useRef(value);

  useEffect(() => {
    currentValue.current = value;
  }, [value]);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchAddresses() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/customer/account/addresses", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (
          !response.data?.success ||
          !Array.isArray(response.data.addresses)
        ) {
          throw new Error("Unable to load saved addresses.");
        }

        const savedAddresses = response.data.addresses.filter(
          (item) => typeof item.address === "string" && item.address.trim(),
        );

        setAddresses(savedAddresses);

        const defaultAddress =
          savedAddresses.find((item) => Boolean(item.isDefault)) ||
          savedAddresses[0];

        // Only fill the field if the user has not entered an address
        if (defaultAddress && !currentValue.current?.trim()) {
          onChange(defaultAddress.address);
        }
      } catch (requestError) {
        if (controller.signal.aborted) return;

        if (requestError.response?.status === 401) {
          navigate("/login", {
            replace: true,
            state: {
              message: "Please log in to access your saved addresses.",
            },
          });
          return;
        }

        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load saved addresses.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchAddresses();

    return () => controller.abort();
  }, [navigate, onChange, retry]);

  const selectedAddress = addresses.some((item) => item.address === value)
    ? value
    : "";

  return (
    <div className={className}>
      <label>
        {title}

        <select
          className="form-control"
          value={selectedAddress}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled || loading}
        >
          <option value="">
            {loading
              ? "Loading saved addresses..."
              : "Enter a different address"}
          </option>

          {addresses.map((item) => (
            <option key={item.id} value={item.address}>
              {item.label || "Saved address"}
              {item.isDefault ? " (Default)" : ""}
              {" - "}
              {item.address}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div role="alert">
          <p className="form-error">{error}</p>

          <button
            type="button"
            className="btn btn-soft"
            onClick={() => setRetry((current) => current + 1)}
            disabled={disabled}
          >
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && addresses.length === 0 && (
        <p>You have no saved addresses. Enter one below.</p>
      )}

      <label>
        Complete address
        <textarea
          className="form-control"
          rows={3}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="House/Unit, Street, Barangay, City, Province"
          required
          disabled={disabled}
        />
      </label>
    </div>
  );
}
