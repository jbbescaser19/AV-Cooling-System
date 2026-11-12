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

// Only one refresh request is sent when many Management/customer calls expire.
let customerRefreshPromise = null;
let managementRefreshPromise = null;

function managementSessionEnded() {
  window.dispatchEvent(new Event("av-management-session-ended"));
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const requestUrl = String(request?.url || "");
    const unauthorized = error.response?.status === 401;
    if (!unauthorized || !request) return Promise.reject(error);

    if (requestUrl.includes("/api/management/")) {
      const skipRefresh = managementNoRefreshEndpoints.some((endpoint) =>
        requestUrl.includes(endpoint),
      );

      if (skipRefresh) return Promise.reject(error);
      if (request._managementRetry) {
        managementSessionEnded();
        return Promise.reject(error);
      }
      request._managementRetry = true;

      try {
        if (!managementRefreshPromise) {
          managementRefreshPromise = api
            .post("/api/management/auth/refresh", {})
            .finally(() => {
              managementRefreshPromise = null;
            });
        }
        await managementRefreshPromise;
        return await api(request);
      } catch (refreshError) {
        // An offline server is not proof that a session has expired.
        if ([401, 403].includes(refreshError.response?.status)) {
          managementSessionEnded();
        }
        return Promise.reject(refreshError);
      }
    }

    const skipCustomerRefresh = customerNoRefreshEndpoints.some((endpoint) =>
      requestUrl.includes(endpoint),
    );
    if (skipCustomerRefresh || request._retry) return Promise.reject(error);

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
