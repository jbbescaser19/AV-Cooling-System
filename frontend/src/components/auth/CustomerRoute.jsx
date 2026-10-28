import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import api from "../../../api/api.js";

import { PENDING_ACTIONS, savePendingAction } from "../../utils/purchaseFlow";

export default function CustomerRoute() {
  const location = useLocation();

  const [status, setStatus] = useState("checking");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function verifySession() {
      setStatus("checking");

      try {
        const response = await api.get("/api/auth/customer/session", {
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setStatus(
          response.data?.authenticated ? "authenticated" : "unauthenticated",
        );
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error.response?.status === 401 || error.response?.status === 403) {
          if (location.pathname === "/checkout") {
            savePendingAction({
              type: PENDING_ACTIONS.CHECKOUT_CART,
            });
          }

          setStatus("unauthenticated");
          return;
        }

        console.error("Customer session check failed:", error);
        setStatus("error");
      }
    }

    verifySession();

    return () => controller.abort();
  }, [location.pathname, retry]);

  if (status === "checking") {
    return (
      <div className="container page-shell" role="status">
        Checking your session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          message: "Please log in to access this page.",
        }}
      />
    );
  }

  if (status === "error") {
    return (
      <div className="container page-shell">
        <p role="alert">
          Unable to verify your login. Check your connection and make sure the
          backend is running.
        </p>

        <button
          type="button"
          className="btn btn-dark"
          onClick={() => setRetry((value) => value + 1)}
        >
          Try Again
        </button>
      </div>
    );
  }

  return <Outlet />;
}
