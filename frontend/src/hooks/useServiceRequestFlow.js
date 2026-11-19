import { useCallback, useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import api from "../../api/api.js";

import { PENDING_ACTIONS, savePendingAction } from "../utils/purchaseFlow";

import useServiceCatalog from "./useServiceCatalog.js";

export default function useServiceRequestFlow(returnTo = "/services") {
  const navigate = useNavigate();
  const location = useLocation();

  const { services, status } = useServiceCatalog();

  const [selectedService, setSelectedService] = useState(null);

  // Restore the requested service after login.
  useEffect(() => {
    const requested = location.state?.serviceRequestId;

    if (!requested || status !== "ready") return;

    let cancelled = false;

    const restore = async () => {
      try {
        await api.get("/api/auth/customer/session");

        if (cancelled) return;

        const service = services.find(
          (item) =>
            String(item.id) === String(requested) ||
            item.serviceType === String(requested),
        );

        if (service?.bookable) {
          setSelectedService(service);
        }

        navigate(
          {
            pathname: location.pathname,
            search: location.search,
            hash: location.hash,
          },
          {
            replace: true,
            state: null,
          },
        );
      } catch (error) {
        if (cancelled) return;

        if (error.response?.status === 401) {
          savePendingAction({
            type: PENDING_ACTIONS.REQUEST_SERVICE,
            serviceId: requested,
            returnTo,
          });

          navigate("/login", {
            replace: true,
          });
        } else {
          console.error("Failed to restore service request:", error);
        }
      }
    };

    restore();

    return () => {
      cancelled = true;
    };
  }, [
    location.pathname,
    location.search,
    location.hash,
    location.state,
    navigate,
    returnTo,
    services,
    status,
  ]);

  const requestService = useCallback(
    async (service) => {
      if (status !== "ready" || !service?.bookable) {
        return;
      }

      try {
        await api.get("/api/auth/customer/session");

        setSelectedService(service);
      } catch (error) {
        if (error.response?.status === 401) {
          savePendingAction({
            type: PENDING_ACTIONS.REQUEST_SERVICE,
            serviceId: service.id,
            returnTo,
          });

          navigate("/login");
        } else {
          console.error("Failed to verify customer login:", error);
        }
      }
    },
    [navigate, returnTo, status],
  );

  const closeServiceRequest = useCallback(() => setSelectedService(null), []);

  return {
    services,
    status,
    selectedService,
    requestService,
    closeServiceRequest,
  };
}
