import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import api from "../../../api/api.js";
import {
  PENDING_ACTIONS,
  getPendingAction,
  savePendingAction,
} from "../../utils/purchaseFlow";

export default function CustomerRoute() {
  const location = useLocation();

  const [status, setStatus] = useState("checking");
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const markUnauthenticated = () => {
      // Preserve direct checkout when the customer must log in first.
      if (location.pathname === "/checkout" && !getPendingAction()) {
        savePendingAction({
          type: PENDING_ACTIONS.CHECKOUT_CART,
        });
      }

      setStatus("unauthenticated");
    };

    const verifySession = async () => {
      try {
        const response = await api.get("/api/auth/customer/me", {
          withCredentials: true,
          signal: controller.signal,
        });

        if (controller.signal.aborted) {
          return;
        }

        if (response.data?.success) {
          setStatus("authenticated");
        } else {
          markUnauthenticated();
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const statusCode = error.response?.status;
        const message = error.response?.data?.message || "";

        const sessionInvalid =
          statusCode === 401 ||
          statusCode === 403 ||
          /authentication required|session is invalid|expired|log in again/i.test(
            message,
          );

        if (sessionInvalid) {
          markUnauthenticated();
          return;
        }

        setStatus("error");
      }
    };

    verifySession();

    return () => {
      controller.abort();
    };
  }, [location.pathname, retryCount]);

  if (status === "checking") {
    return <p role="status">Checking your session...</p>;
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          message: "Please log in to continue.",
        }}
      />
    );
  }

  if (status === "error") {
    return (
      <div role="alert">
        <p>Unable to contact the authentication service.</p>

        <button
          type="button"
          onClick={() => {
            setStatus("checking");
            setRetryCount((previous) => previous + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return <Outlet />;
}
