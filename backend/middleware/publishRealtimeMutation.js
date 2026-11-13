import { recordBusinessChange } from "../services/realtime/realtimeEventService.js";

/** One place captures successful writes across ALL application routes, webhooks included. */
export function publishRealtimeMutation(req, res, next) {
  const method = req.method.toUpperCase();
  const path = req.originalUrl.split("?")[0];
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const ignored =
    /^\/api\/(?:auth\/customer|management\/auth)\/(?:login|logout|refresh|session|reauth)(?:\/|$)/.test(
      path,
    ) ||
    /^\/api\/realtime\b/.test(path) ||
    /^\/api\/customer\/account\/(password|profile)/.test(path);
  if (isMutation && !ignored) {
    res.once("finish", () => {
      // Publish AFTER the endpoint sends a successful response (normally after commit).
      if (res.statusCode >= 200 && res.statusCode < 300) {
        void recordBusinessChange(path).catch((error) => {
          console.error("Realtime change publication failed:", error);
        });
      }
    });
  }
  next();
}
