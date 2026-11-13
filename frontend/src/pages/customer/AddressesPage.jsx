import { confirmAction } from "../../utils/confirmAction.js";
import { useEffect, useState } from "react";
import { Check, Home, MapPin, Plus, Trash2, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../../../api/api.js";
import useRealtimeRefresh from "../../hooks/useRealtimeRefresh.js";
import CustomerDialog from "../../components/customer/CustomerDialog";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import "../../styles/customer/address-page.css";

const MAX_SAVED_ADDRESSES = 5;
const LABEL_ICONS = { HOME: Home, OFFICE: Building2, OTHER: MapPin };

export default function AddressesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("HOME");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [formError, setFormError] = useState("");
  const [retry, setRetry] = useState(0);
  useRealtimeRefresh(["customers"], setRetry);

  function showFailure(error) {
    if (error.response?.status === 401) {
      navigate("/login", {
        replace: true,
        state: { message: "Please log in to manage your addresses." },
      });
      return;
    }
    setError(
      error.response?.data?.message ||
        error.message ||
        "Could not update your address.",
    );
  }

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/api/customer/account/addresses", { signal: controller.signal })
      .then(({ data }) => {
        if (!controller.signal.aborted) {
          if (!data.success || !Array.isArray(data.addresses))
            throw new Error("Could not read addresses.");
          setItems(data.addresses);
          setError("");
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) showFailure(err);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
    // Authentication redirect is handled in showFailure; retry refreshes the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, retry]);

  async function add(event) {
    event.preventDefault();
    const fullAddress = address.trim();
    if (fullAddress.length < 10) {
      setFormError(
        "Enter a complete address with house/street, barangay, city and province.",
      );
      return;
    }
    setSaving(true);
    setFormError("");
    setError("");
    try {
      await api.post("/api/customer/account/addresses", { label, fullAddress });
      setOpen(false);
      setLabel("HOME");
      setAddress("");
      setNotice("Address saved successfully.");
      setRetry((n) => n + 1);
    } catch (err) {
      if (err.response?.status === 401) showFailure(err);
      else
        setFormError(err.response?.data?.message || "Could not save address.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (
      !(await confirmAction(
        "Remove this saved address? Existing orders will not be changed.",
      ))
    )
      return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.delete(`/api/customer/account/addresses/${id}`);
      setNotice("Address removed.");
      setRetry((n) => n + 1);
    } catch (err) {
      showFailure(err);
    } finally {
      setSaving(false);
    }
  }

  async function makeDefault(id) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await api.patch(`/api/customer/account/addresses/${id}/default`);
      setNotice("Default address updated.");
      setRetry((n) => n + 1);
    } catch (err) {
      showFailure(err);
    } finally {
      setSaving(false);
    }
  }

  const canAdd = !loading && !saving && items.length < MAX_SAVED_ADDRESSES;

  return (
    <section className="customer-module av-address-page">
      <div className="av-address-page__header">
        <CustomerPageHeader
          Icon={MapPin}
          title="Saved addresses"
          copy="Choose where we deliver or provide services."
        />
        <button
          type="button"
          className="btn btn-dark av-address-page__add"
          disabled={!canAdd}
          onClick={() => {
            setFormError("");
            setOpen(true);
          }}
        >
          <Plus size={17} /> Add address
        </button>
      </div>
      <div className="av-address-page__summary">
        <span>
          <MapPin size={15} /> {items.length} of {MAX_SAVED_ADDRESSES} saved
        </span>
        <span>Use your default address for faster checkout.</span>
      </div>
      {notice && (
        <p className="av-address-page__success" role="status">
          <Check size={16} />
          {notice}
        </p>
      )}
      {error && (
        <div className="av-address-page__error" role="alert">
          {error}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </button>
        </div>
      )}
      {loading ? (
        <p className="av-address-page__loading" role="status">
          Loading your addresses…
        </p>
      ) : !error && items.length === 0 ? (
        <div className="av-address-page__empty">
          <MapPin size={27} />
          <h3>No saved addresses yet</h3>
          <p>Add your home or office for faster checkout and booking.</p>
          <button
            type="button"
            className="btn btn-dark"
            onClick={() => setOpen(true)}
          >
            Add your first address
          </button>
        </div>
      ) : !error ? (
        <div className="av-address-page__grid">
          {items.map((item) => {
            const Icon =
              LABEL_ICONS[String(item.label).toUpperCase()] || MapPin;
            return (
              <article
                className={`av-address-card${item.default ? " is-default" : ""}`}
                key={item.id}
              >
                <div className="av-address-card__heading">
                  <div className="av-address-card__icon">
                    <Icon size={19} />
                  </div>
                  <div className="av-address-card__title">
                    <h3>{item.label || "Saved address"}</h3>
                    <span>Delivery &amp; service location</span>
                  </div>
                  {item.default && (
                    <span className="av-address-card__badge">
                      <Check size={13} /> Default
                    </span>
                  )}
                </div>
                <p className="av-address-card__address">{item.address}</p>
                <div className="av-address-card__actions">
                  {!item.default && (
                    <button
                      type="button"
                      className="av-address-card__set"
                      disabled={saving}
                      onClick={() => makeDefault(item.id)}
                    >
                      <Check size={15} /> Set default
                    </button>
                  )}
                  <button
                    type="button"
                    className="av-address-card__delete"
                    disabled={saving}
                    aria-label={`Remove ${item.label || "saved"} address`}
                    onClick={() => remove(item.id)}
                  >
                    <Trash2 size={15} /> Remove
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
      {open && (
        <CustomerDialog
          title="Add an address"
          onClose={() => {
            if (!saving) setOpen(false);
          }}
        >
          <form className="av-address-page__form" onSubmit={add}>
            <label htmlFor="new-address-label">Address type</label>
            <select
              id="new-address-label"
              className="form-control"
              value={label}
              disabled={saving}
              onChange={(e) => setLabel(e.target.value)}
            >
              <option value="HOME">Home</option>
              <option value="OFFICE">Office</option>
              <option value="OTHER">Other</option>
            </select>
            <label htmlFor="new-address-complete">Complete address</label>
            <textarea
              id="new-address-complete"
              className="form-control"
              value={address}
              maxLength={500}
              disabled={saving}
              onChange={(e) => setAddress(e.target.value)}
              rows={4}
              placeholder="House/Unit, Street, Barangay, City, Province"
              required
            />
            <small>
              Include a landmark if it helps our technician find the location.
            </small>
            {formError && (
              <p role="alert" className="av-address-page__error">
                {formError}
              </p>
            )}
            <div className="av-address-page__form-actions">
              <button
                type="button"
                className="btn btn-soft"
                disabled={saving}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-dark" disabled={saving}>
                {saving ? "Saving…" : "Save address"}
              </button>
            </div>
          </form>
        </CustomerDialog>
      )}
    </section>
  );
}
