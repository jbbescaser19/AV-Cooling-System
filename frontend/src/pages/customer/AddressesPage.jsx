import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import api from "../../../api/api.js";
import CustomerDialog from "../../components/customer/CustomerDialog";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";

const MAX_SAVED_ADDRESSES = 5;

export default function AddressesPage() {
  const navigate = useNavigate();

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Home");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

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
          !Array.isArray(response.data?.addresses)
        ) {
          throw new Error("Customer addresses were not returned.");
        }

        setItems(response.data.addresses);
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.response?.status === 401) {
          navigate("/login", {
            replace: true,
            state: {
              message: "Please log in to manage your addresses.",
            },
          });
          return;
        }

        setError(
          error.response?.data?.message ||
            error.message ||
            "Unable to load your addresses.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchAddresses();

    return () => controller.abort();
  }, [navigate, retry]);

  function handleRequestError(error) {
    if (error.response?.status === 401) {
      navigate("/login", {
        replace: true,
        state: {
          message: "Please log in to manage your addresses.",
        },
      });
      return;
    }

    window.alert(
      error.response?.data?.message ||
        error.message ||
        "The address request failed.",
    );
  }

  async function add() {
    if (!address.trim()) {
      window.alert("Please enter a complete address.");
      return;
    }

    setSaving(true);

    try {
      await api.post("/api/customer/account/addresses", {
        label: label.toUpperCase(),
        fullAddress: address.trim(),
      });

      setOpen(false);
      setAddress("");
      setLabel("Home");
      setRetry((value) => value + 1);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!window.confirm("Are you sure you want to delete this address?")) {
      return;
    }

    setSaving(true);

    try {
      await api.delete(`/api/customer/account/addresses/${id}`);

      setRetry((value) => value + 1);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(id) {
    setSaving(true);

    try {
      await api.patch(`/api/customer/account/addresses/${id}/default`);

      setRetry((value) => value + 1);
    } catch (error) {
      handleRequestError(error);
    } finally {
      setSaving(false);
    }
  }

  const maxReached = items.length >= MAX_SAVED_ADDRESSES;

  return (
    <div className="customer-module">
      <div className="customer-module-action-head">
        <CustomerPageHeader
          Icon={MapPin}
          title="Addresses"
          copy={`Saved delivery and service addresses. Maximum ${MAX_SAVED_ADDRESSES}.`}
        />

        <button
          className="btn btn-dark"
          type="button"
          disabled={loading || saving || maxReached}
          onClick={() => setOpen(true)}
        >
          <Plus size={16} />
          {maxReached ? "Maximum Reached" : "Add Address"}
        </button>
      </div>

      {loading && (
        <section className="surface">
          <p role="status">Loading your addresses...</p>
        </section>
      )}

      {!loading && error && (
        <section className="surface">
          <p role="alert">{error}</p>

          <button
            className="btn btn-dark"
            type="button"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try Again
          </button>
        </section>
      )}

      {!loading && !error && (
        <div className="customer-address-grid">
          {items.map((item) => (
            <article className="surface customer-address" key={item.id}>
              <div className="customer-address-head">
                <strong>{item.label}</strong>

                {item.default && (
                  <span className="badge badge-blue">Default</span>
                )}
              </div>

              <p>{item.address}</p>

              <div className="customer-address-actions">
                {!item.default && (
                  <button
                    type="button"
                    className="btn btn-soft"
                    disabled={saving}
                    onClick={() => makeDefault(item.id)}
                  >
                    Make Default
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-danger"
                  aria-label={`Delete ${item.label}`}
                  disabled={saving}
                  onClick={() => remove(item.id)}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </article>
          ))}

          {!items.length && (
            <div className="surface empty-state">
              <MapPin size={30} />
              <h3>No saved addresses</h3>
              <p>Add an address for faster checkout and service requests.</p>
            </div>
          )}
        </div>
      )}

      {open && (
        <CustomerDialog
          title="Add Address"
          onClose={() => {
            if (!saving) setOpen(false);
          }}
        >
          <div className="customer-form-card dialog-form">
            <label>
              Label
              <select
                className="form-control"
                value={label}
                disabled={saving}
                onChange={(event) => setLabel(event.target.value)}
              >
                <option>Home</option>
                <option>Office</option>
                <option>Other</option>
              </select>
            </label>

            <label>
              Complete address
              <textarea
                className="form-control"
                value={address}
                disabled={saving}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="House/Unit, Street, Barangay, City, Province"
              />
            </label>

            <button
              type="button"
              className="btn btn-dark"
              disabled={saving}
              onClick={add}
            >
              {saving ? "Saving..." : "Save Address"}
            </button>
          </div>
        </CustomerDialog>
      )}
    </div>
  );
}
