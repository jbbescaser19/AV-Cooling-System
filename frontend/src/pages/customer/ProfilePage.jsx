import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UserRound } from "lucide-react";

import api from "../../../api/api.js";
import CustomerPageHeader from "../../components/customer/CustomerPageHeader";

export default function ProfilePage() {
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

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

        const user = response.data.user;

        setProfile({
          name: user.name || "",
          email: user.email || "",
          phone: user.phone || "",
          status: user.status || "Unknown",
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

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={UserRound}
        title="Profile"
        copy="View your AV Cooling System account information."
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
        <section className="surface customer-profile-grid">
          <label>
            Full name
            <input className="form-control" value={profile.name} readOnly />
          </label>

          <label>
            Email
            <input
              className="form-control"
              type="email"
              value={profile.email}
              readOnly
            />
          </label>

          <label>
            Phone
            <input
              className="form-control"
              type="tel"
              value={profile.phone}
              readOnly
            />
          </label>

          <label>
            Account status
            <input className="form-control" value={profile.status} readOnly />
          </label>
        </section>
      )}
    </div>
  );
}
