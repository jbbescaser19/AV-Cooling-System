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

// Access tokens stay in secure HttpOnly cookies, never localStorage.
// The expiry timestamp is non-secret and helps avoid an unnecessary 401
// when staff submit a sale near the 15-minute access-token expiry.
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

  // A session is established or resumed by the Management login/layout.
  // Refresh shortly before expiry to prevent an interrupted POS submission.
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

export default api;
