import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { services } from "../data/services";
import api from "../../api/api.js";
import { PENDING_ACTIONS, savePendingAction } from "../utils/purchaseFlow";

export default function useServiceRequestFlow(returnTo = "/services") {
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedService, setSelectedService] = useState(null);

  // Restore the requested service after the customer logs in.
  useEffect(() => {
    let cancelled = false;

    const restoreService = async () => {
      const requestedServiceId = location.state?.serviceRequestId;

      if (!requestedServiceId) {
        return;
      }

      try {
        await api.get("/api/auth/customer/me");

        if (cancelled) {
          return;
        }

        const service = services.find((item) => item.id === requestedServiceId);

        if (service) {
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
        if (cancelled) {
          return;
        }

        if (error.response?.status === 401) {
          savePendingAction({
            type: PENDING_ACTIONS.REQUEST_SERVICE,
            serviceId: requestedServiceId,
            returnTo,
          });

          navigate("/login", { replace: true });
          return;
        }

        console.error("Failed to restore service request:", error);
      }
    };

    restoreService();

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
  ]);

  // Check the backend session before allowing a service request.
  const requestService = useCallback(
    async (service) => {
      try {
        await api.get("/api/auth/customer/me");
        setSelectedService(service);
      } catch (error) {
        if (error.response?.status === 401) {
          savePendingAction({
            type: PENDING_ACTIONS.REQUEST_SERVICE,
            serviceId: service.id,
            returnTo,
          });

          navigate("/login");
          return;
        }

        console.error("Failed to verify customer login:", error);
      }
    },
    [navigate, returnTo],
  );

  const closeServiceRequest = useCallback(() => {
    setSelectedService(null);
  }, []);

  return {
    selectedService,
    requestService,
    closeServiceRequest,
  };
}
