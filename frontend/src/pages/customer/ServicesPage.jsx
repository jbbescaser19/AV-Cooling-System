import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";

import api from "../../../api/api.js";

import CustomerPageHeader from "../../components/customer/CustomerPageHeader";
import CustomerStatusBadge from "../../components/customer/CustomerStatusBadge";

function formatSchedule(value) {
  if (!value) {
    return "Schedule not specified";
  }

  const [date, time] = String(value).replace("T", " ").split(" ");

  if (!date) {
    return "Schedule not specified";
  }

  return time ? `${date} at ${time.slice(0, 5)}` : date;
}

export default function ServicesPage() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchMyServices() {
      setLoading(true);
      setError("");

      try {
        const response = await api.get("/api/customer/account/my-services", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (
          response.data?.success !== true ||
          !Array.isArray(response.data.services)
        ) {
          throw new Error("Invalid service bookings response.");
        }

        setServices(response.data.services);
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setServices([]);

        if (requestError.response?.status === 401) {
          setError("Please log in to view your service bookings.");
          return;
        }

        setError(
          requestError.response?.data?.message ||
            requestError.message ||
            "Unable to load your service bookings.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    fetchMyServices();

    return () => {
      controller.abort();
    };
  }, [retryCount]);

  return (
    <div className="customer-module">
      <CustomerPageHeader
        Icon={Wrench}
        title="Service Bookings"
        copy="View service requests, preferred schedules, and job status."
      />

      <div className="customer-record-list">
        {loading && <p role="status">Loading your service bookings...</p>}

        {!loading && error && (
          <div className="surface customer-record">
            <div>
              <strong>Unable to load services</strong>

              <span role="alert">{error}</span>
            </div>

            <button
              className="btn btn-soft"
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
            >
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && services.length === 0 && (
          <div className="surface customer-record">
            <div>
              <strong>No service bookings yet</strong>

              <span>Your submitted service requests will appear here.</span>
            </div>
          </div>
        )}

        {!loading &&
          !error &&
          services.map((service) => (
            <article
              className="surface customer-record"
              key={service.requestId}
            >
              <div>
                <strong>{service.serviceName}</strong>

                <span>
                  Request #{service.requestId}
                  {" · "}
                  {formatSchedule(service.preferredStart)}
                </span>

                <small>{service.serviceAddress}</small>

                {service.destinationAddress && (
                  <small>Destination: {service.destinationAddress}</small>
                )}
              </div>

              <CustomerStatusBadge>{service.status}</CustomerStatusBadge>
            </article>
          ))}
      </div>
    </div>
  );
}
