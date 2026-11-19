import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { UserRound, Pencil, Save, X } from "lucide-react";

import api from "../../../api/api.js";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";

function sanitizeName(value) {
  return value.replace(/[^\p{L}\p{M} .'-]/gu, "");
}

function sanitizePhone(value) {
  const digits = value.replace(/[^0-9]/g, "");

  return value.trimStart().startsWith("+") ? `+${digits}` : digits;
}

function formatProfile(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    phone: user.phone || "",
    status: user.status || "Unknown",
  };
}

export default function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    name: "",
    phone: "",
  });

  const savingRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchProfile() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/customer/account/profile", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        if (!response.data?.success || !response.data?.user) {
          throw new Error("Customer profile was not returned.");
        }

        const user = formatProfile(response.data.user);

        setProfile(user);

        setForm({
          name: user.name,
          phone: user.phone,
        });
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.response?.status === 401) {
          navigate("/login", {
            replace: true,
            state: {
              message: "Please log in to access your profile.",
            },
          });

          return;
        }

        setError(
          error.response?.data?.message ||
            error.message ||
            "Unable to load your profile.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchProfile();

    return () => controller.abort();
  }, [navigate, retry]);

  function startEditing() {
    if (!profile || savingRef.current) return;

    setForm({
      name: profile.name,
      phone: profile.phone,
    });

    setSuccess("");
    setSaveError("");
    setEditing(true);
  }

  function cancelEditing() {
    if (!profile || savingRef.current) return;

    setForm({
      name: profile.name,
      phone: profile.phone,
    });

    setSaveError("");
    setEditing(false);
  }

  function updateField(field, value) {
    let sanitizedValue = value;

    if (field === "name") {
      sanitizedValue = sanitizeName(value);
    }

    if (field === "phone") {
      sanitizedValue = sanitizePhone(value);
    }

    setForm((previous) => ({
      ...previous,
      [field]: sanitizedValue,
    }));

    setSaveError("");
  }

  async function handleSave(event) {
    event.preventDefault();

    if (!editing || savingRef.current) return;

    setSaveError("");
    setSuccess("");

    const name = form.name.trim();
    const phone = form.phone.trim().replace(/[\s-]/g, "");

    if (
      name.length < 2 ||
      name.length > 150 ||
      !/^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u.test(name)
    ) {
      setSaveError("Enter a valid full name.");
      return;
    }

    if (!/^(?:\+63|0)9\d{9}$/.test(phone)) {
      setSaveError("Enter a valid Philippine mobile number.");
      return;
    }

    savingRef.current = true;
    setSaving(true);

    try {
      const response = await api.patch("/api/customer/account/profile", {
        name,
        phone,
      });

      if (!response.data?.success || !response.data?.user) {
        throw new Error("Unable to update your profile.");
      }

      const updated = formatProfile(response.data.user);

      setProfile(updated);

      setForm({
        name: updated.name,
        phone: updated.phone,
      });

      setEditing(false);

      setSuccess(response.data.message || "Profile updated successfully.");
    } catch (error) {
      if (error.response?.status === 401) {
        navigate("/login", {
          replace: true,
          state: {
            message: "Please log in again to update your profile.",
          },
        });

        return;
      }

      setSaveError(
        error.response?.data?.message ||
          error.message ||
          "Unable to update your profile.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={UserRound}
        title="Profile"
        copy="View and manage your AV Cooling System account information."
      />

      {loading && (
        <section className="surface customer-profile-grid">
          <p role="status">Loading your profile...</p>
        </section>
      )}

      {!loading && error && (
        <section className="surface customer-profile-grid">
          <p role="alert">{error}</p>

          <button
            type="button"
            className="btn btn-dark"
            onClick={() => setRetry((value) => value + 1)}
          >
            Try Again
          </button>
        </section>
      )}

      {!loading && !error && profile && (
        <form className="surface customer-profile-grid" onSubmit={handleSave}>
          <label>
            Full name
            <input
              className="form-control"
              type="text"
              autoComplete="name"
              value={editing ? form.name : profile.name}
              onChange={(event) => updateField("name", event.target.value)}
              readOnly={!editing || saving}
              minLength={2}
              maxLength={150}
              required
            />
          </label>

          <label>
            Email
            <input
              className="form-control"
              type="email"
              value={profile.email}
              readOnly
            />
            {editing && (
              <small>Your verified login email cannot be changed here.</small>
            )}
          </label>

          <label>
            Phone
            <input
              className="form-control"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={editing ? form.phone : profile.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              readOnly={!editing || saving}
              maxLength={30}
              placeholder="09XXXXXXXXX"
              required
            />
          </label>

          <label>
            Account status
            <CustomerStatusBadge>{profile.status}</CustomerStatusBadge>
          </label>

          {saveError && (
            <p
              role="alert"
              style={{
                gridColumn: "1 / -1",
                color: "#b91c1c",
                fontSize: "0.875rem",
                margin: 0,
              }}
            >
              {saveError}
            </p>
          )}

          {success && (
            <p
              role="status"
              style={{
                gridColumn: "1 / -1",
                color: "#15803d",
                fontSize: "0.875rem",
                margin: 0,
              }}
            >
              {success}
            </p>
          )}

          <div
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              flexWrap: "wrap",
              gap: "8px",
              paddingTop: "8px",
            }}
          >
            {!editing ? (
              <button
                type="button"
                className="btn btn-dark"
                onClick={startEditing}
              >
                <Pencil size={15} />
                Edit Profile
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn"
                  onClick={cancelEditing}
                  disabled={saving}
                >
                  <X size={15} />
                  Cancel
                </button>

                <button
                  type="submit"
                  className="btn btn-dark"
                  disabled={saving}
                >
                  <Save size={15} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
