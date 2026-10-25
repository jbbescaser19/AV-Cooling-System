import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";

import CustomerDialog from "../../components/customer/CustomerDialog";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";

import {
  MAX_SAVED_ADDRESSES,
  addCustomerAddress,
  deleteCustomerAddress,
  readCustomerAddresses,
  setDefaultCustomerAddress,
} from "../../utils/addressStore";

export default function AddressesPage() {
  const [items, setItems] = useState(() => readCustomerAddresses());
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("Home");
  const [address, setAddress] = useState("");

  const add = () => {
    if (!address.trim()) {
      window.alert("Please enter a complete address.");
      return;
    }

    try {
      const result = addCustomerAddress({
        label,
        address: address.trim(),
      });

      setItems(result.addresses);
      setOpen(false);
      setAddress("");
      setLabel("Home");
    } catch (error) {
      window.alert(error.message);
    }
  };

  const remove = (id) => {
    const nextItems = deleteCustomerAddress(id);
    setItems(nextItems);
  };

  const makeDefault = (id) => {
    const nextItems = setDefaultCustomerAddress(id);
    setItems(nextItems);
  };

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
          disabled={maxReached}
          onClick={() => setOpen(true)}
        >
          <Plus size={16} />
          {maxReached ? "Maximum Reached" : "Add Address"}
        </button>
      </div>

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
                  onClick={() => makeDefault(item.id)}
                >
                  Make Default
                </button>
              )}

              <button
                type="button"
                className="btn btn-danger"
                aria-label={`Delete ${item.label}`}
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

      {open && (
        <CustomerDialog title="Add Address" onClose={() => setOpen(false)}>
          <div className="customer-form-card dialog-form">
            <label>
              Label
              <select
                className="form-control"
                value={label}
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
                onChange={(event) => setAddress(event.target.value)}
                placeholder="House/Unit, Street, Barangay, City, Province"
              />
            </label>

            <button type="button" className="btn btn-dark" onClick={add}>
              Save Address
            </button>
          </div>
        </CustomerDialog>
      )}
    </div>
  );
}
