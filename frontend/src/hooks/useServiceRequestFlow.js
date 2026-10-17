import { useEffect, useState } from "react";

import { useLocation, useNavigate } from "react-router-dom";

import { services } from "../data/services";

import { getCustomer } from "../utils/authMock";

import { PENDING_ACTIONS, savePendingAction } from "../utils/purchaseFlow";

export default function useServiceRequestFlow(returnTo = "/services") {
  const navigate = useNavigate();

  const location = useLocation();

  const [selectedService, setSelectedService] = useState(null);
  //if not login then click request service then login succeeds then it do this
  useEffect(() => {
    const requestedServiceId = location.state?.serviceRequestId;

    if (!requestedServiceId || !getCustomer()) {
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
  }, [
    location.pathname,
    location.search,
    location.hash,
    location.state,
    navigate,
  ]);

  const requestService = (service) => {
    if (!getCustomer()) {
      savePendingAction({
        type: PENDING_ACTIONS.REQUEST_SERVICE,
        serviceId: service.id,
        returnTo,
      });

      navigate("/login");

      return;
    }

    setSelectedService(service);
  };

  const closeServiceRequest = () => {
    setSelectedService(null);
  };

  return {
    selectedService,
    requestService,
    closeServiceRequest,
  };
}
