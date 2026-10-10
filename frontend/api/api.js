import axios from "axios";

//create axios instance
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000", // .env version for frontend
  withCredentials: true, //to allow cookies
});

// helper to check excluded routes
const isAuthRoute = (url = "") =>
  ["/login", "/signup", "/refresh"].some((route) => url.includes(route));

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config; //Save the request that failed

    if (!error.response) {
      // Error is not from an HTTP response
      return Promise.reject(error); //it passes the error back to whoever is responsible for handling it.
    }

    const isUnauthorized = error.response.status === 401;

    if (
      isUnauthorized &&
      !originalRequest._retry &&
      !isAuthRoute(originalRequest.url)
    ) {
      originalRequest._retry = true; // It marks the request as retried so it won't loop; if the request gets a 401 again, _retry is already true, so it won't retry the request again.

      try {
        await api.post("/api/tasks/refresh");
        return api(originalRequest); //Call (send) the original HTTP request again.
      } catch (refreshError) {
        window.location.assign("/");
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default api;
