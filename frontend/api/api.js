import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  withCredentials: true,
});

const customerNoRefreshEndpoints = [
  "/api/auth/customer/login",
  "/api/auth/customer/register",
  "/api/auth/customer/refresh",
  "/api/auth/customer/logout",
];

const managementNoRefreshEndpoints = [
  "/api/management/auth/login",
  "/api/management/auth/refresh",
  "/api/management/auth/logout",
];

let managementAccessExpiresAt = 0;
let managementRefreshPromise = null;
let customerRefreshPromise = null;
let sessionEndedNotified = false;

function managementSessionEnded() {
  managementAccessExpiresAt = 0;

  if (!sessionEndedNotified) {
    sessionEndedNotified = true;

    window.dispatchEvent(new Event("av-management-session-ended"));
  }
}

function updateManagementExpiry(response) {
  const url = String(response?.config?.url || "");

  if (!url.includes("/api/management/auth/")) return;

  if (url.includes("/auth/logout")) {
    managementAccessExpiresAt = 0;
    return;
  }

  const expiresAt = Number(response?.data?.session?.accessExpiresAt);

  if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
    managementAccessExpiresAt = expiresAt;
    sessionEndedNotified = false;
  }
}

function refreshManagementAccess() {
  if (!managementRefreshPromise) {
    managementRefreshPromise = api
      .post("/api/management/auth/refresh", {})
      .then((response) => {
        updateManagementExpiry(response);
        return response;
      })
      .finally(() => {
        managementRefreshPromise = null;
      });
  }

  return managementRefreshPromise;
}

api.interceptors.request.use(async (request) => {
  const url = String(request.url || "");

  if (
    !url.includes("/api/management/") ||
    url.includes("/api/management/auth/")
  ) {
    return request;
  }

  if (
    managementAccessExpiresAt &&
    Date.now() >= managementAccessExpiresAt - 60_000
  ) {
    try {
      await refreshManagementAccess();
    } catch (error) {
      if ([401, 403].includes(error.response?.status)) {
        managementSessionEnded();
      }

      return Promise.reject(error);
    }
  }

  return request;
});

api.interceptors.response.use(
  (response) => {
    updateManagementExpiry(response);
    return response;
  },

  async (error) => {
    const request = error.config;
    const url = String(request?.url || "");

    if (error.response?.status !== 401 || !request) {
      return Promise.reject(error);
    }

    if (url.includes("/api/management/")) {
      if (
        managementNoRefreshEndpoints.some((endpoint) => url.includes(endpoint))
      ) {
        return Promise.reject(error);
      }

      if (request._managementRetry) {
        managementSessionEnded();
        return Promise.reject(error);
      }

      request._managementRetry = true;

      try {
        await refreshManagementAccess();
        return await api(request);
      } catch (refreshError) {
        if ([401, 403].includes(refreshError.response?.status)) {
          managementSessionEnded();
        }

        return Promise.reject(refreshError);
      }
    }

    if (
      customerNoRefreshEndpoints.some((endpoint) => url.includes(endpoint)) ||
      request._retry
    ) {
      return Promise.reject(error);
    }

    request._retry = true;

    try {
      if (!customerRefreshPromise) {
        customerRefreshPromise = api
          .post("/api/auth/customer/refresh")
          .finally(() => {
            customerRefreshPromise = null;
          });
      }

      await customerRefreshPromise;

      return await api(request);
    } catch {
      return Promise.reject(error);
    }
  },
);

const reportedErrors = new WeakSet();

function reportActionError(error) {
  if (
    typeof window === "undefined" ||
    !error ||
    axios.isCancel(error) ||
    error.code === "ERR_CANCELED" ||
    reportedErrors.has(error)
  ) {
    return;
  }

  const request = error.config;

  if (!request) return;

  const method = String(request.method || "").toUpperCase();
  const url = String(request.url || "");

  // Background reads and polling must not interrupt the user.
  if (!["POST", "PATCH", "PUT", "DELETE"].includes(method)) {
    return;
  }

  if (/\/(?:refresh|activity|session|logout)(?:[/?#]|$)/i.test(url)) {
    return;
  }

  reportedErrors.add(error);

  const status = Number(error.response?.status || 0);
  const serverMessage = error.response?.data?.message;

  let title = "Action not completed";
  let message = "";

  if (!error.response) {
    title = "Connection interrupted";

    message =
      "The server could not confirm the result. Check whether the transaction was saved before trying again.";
  } else if (status === 401) {
    title = "Authentication required";

    message =
      typeof serverMessage === "string" && serverMessage.trim()
        ? serverMessage.trim()
        : "Please verify your login details or sign in again.";
  } else if (status === 403) {
    title = "Action not allowed";

    message =
      typeof serverMessage === "string" && serverMessage.trim()
        ? serverMessage.trim()
        : "Your account does not have permission for this action.";
  } else if (status === 409) {
    title = "Unable to complete this action";

    message =
      typeof serverMessage === "string" && serverMessage.trim()
        ? serverMessage.trim()
        : "The record may have changed. Refresh and check before trying again.";
  } else if (status === 400 || status === 422) {
    title = "Check the required details";

    message =
      typeof serverMessage === "string" && serverMessage.trim()
        ? serverMessage.trim()
        : "Some information is missing or invalid.";
  } else if (status >= 500) {
    title = "Server error";

    message =
      "The server could not confirm the result. Check the record before trying again.";
  } else {
    message =
      typeof serverMessage === "string" && serverMessage.trim()
        ? serverMessage.trim()
        : "The request could not be completed.";
  }

  window.dispatchEvent(
    new CustomEvent("av-action-error", {
      detail: {
        title,
        message: message.slice(0, 1200),
      },
    }),
  );
}

// Runs after the existing authentication recovery logic.
api.interceptors.response.use(
  (response) => response,

  (error) => {
    reportActionError(error);
    return Promise.reject(error);
  },
);

export default api;
