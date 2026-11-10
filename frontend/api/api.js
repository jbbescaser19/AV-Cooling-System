import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000",
  withCredentials: true,
});

// These requests must not trigger another refresh attempt.
const noRefreshEndpoints = [
  "/api/auth/customer/login",
  "/api/auth/customer/register",
  "/api/auth/customer/refresh",
  "/api/auth/customer/logout",
];

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || "");

    // A revoked or expired Management cookie must also close the Management UI.
    // Incorrect passwords during login/reauthentication are not session-expiry events.
    if (
      error.response?.status === 401 &&
      requestUrl.includes("/api/management/") &&
      !requestUrl.includes("/auth/login") &&
      !requestUrl.includes("/auth/reauthenticate") &&
      !requestUrl.includes("/auth/logout")
    ) {
      window.dispatchEvent(new Event("av-management-session-ended"));
    }

    const shouldSkipRefresh =
      requestUrl.includes("/api/management/") ||
      noRefreshEndpoints.some((endpoint) => requestUrl.includes(endpoint));

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      shouldSkipRefresh
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      if (!refreshPromise) {
        refreshPromise = api.post("/api/auth/customer/refresh");
      }

      await refreshPromise;

      return api(originalRequest);
    } catch {
      return Promise.reject(error);
    } finally {
      refreshPromise = null;
    }
  },
);

export default api;
