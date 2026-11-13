import express from "express";
import { purgeExpiredArchive } from "./services/management/archiveService.js";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import realtimeRoutes from "./routes/realtime/realtimeRoutes.js";
import { cleanupRealtimeEvents } from "./services/realtime/realtimeEventService.js";
import { publishRealtimeMutation } from "./middleware/publishRealtimeMutation.js";

import publicCatalogRoutes from "./routes/public/catalogRoutes.js";
import authRoutes from "./routes/customer/authRoutes.js";
import accountRoutes from "./routes/customer/accountRoutes.js";
import serviceRoutes from "./routes/customer/serviceRoutes.js";
import cartRoutes from "./routes/customer/cartRoutes.js";
import orderRoutes from "./routes/customer/orderRoutes.js";
import notificationRoutes from "./routes/customer/notificationRoutes.js";
import feedbackRoutes from "./routes/customer/feedbackRoutes.js";
import managementAuthRoutes from "./routes/management/authRoutes.js";
import bookingScheduleRoutes from "./routes/scheduling/bookingScheduleRoutes.js";
import managementBookingScheduleRoutes from "./routes/management/bookingScheduleRoutes.js";
import managementOperationsRoutes from "./routes/management/operationsRoutes.js";
import managementDashboardRoutes from "./routes/management/dashboardRoutes.js";
import managementSalesRoutes from "./routes/management/salesRoutes.js";
import managementWorkspaceRoutes from "./routes/management/workspaceRoutes.js";
import paymongoCustomerRoutes from "./routes/payments/paymongoCustomerRoutes.js";
import paymongoStaffRoutes from "./routes/payments/paymongoStaffRoutes.js";
import { paymongoWebhookController } from "./controllers/payments/paymongoController.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173",
    credentials: true,
  }),
);

app.use(publishRealtimeMutation);

// PayMongo signs the exact RAW request bytes. Mount before JSON parsing and auth middleware.
app.post(
  "/api/webhooks/paymongo",
  express.raw({ type: "application/json", limit: "256kb" }),
  paymongoWebhookController,
);
app.use(express.json());
app.use(cookieParser());

app.use("/api/realtime", realtimeRoutes);
app.use("/api/catalog", publicCatalogRoutes);
app.use("/api/schedule", bookingScheduleRoutes);
app.use("/api/auth/customer", authRoutes);
app.use("/api/customer/account", accountRoutes);
app.use("/api/customer/services", serviceRoutes);
app.use("/api/customer/cart", cartRoutes);
app.use("/api/customer/orders", orderRoutes);
app.use("/api/customer/paymongo", paymongoCustomerRoutes);
app.use("/api/customer/notifications", notificationRoutes);
app.use("/api/customer/feedback", feedbackRoutes);
app.use("/api/management/auth", managementAuthRoutes);
app.use("/api/management/schedule", managementBookingScheduleRoutes);
app.use("/api/management/dashboard", managementDashboardRoutes);
app.use("/api/management/sales", managementSalesRoutes);
app.use("/api/management/paymongo", paymongoStaffRoutes);
app.use("/api/management/workspace", managementWorkspaceRoutes);
app.use("/api/management", managementOperationsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Archive retention applies while the backend server is running.
  // Historical records protected by foreign keys remain safely archived.
  const cleanup = () =>
    purgeExpiredArchive().catch((error) =>
      console.error("Archive retention cleanup failed:", error),
    );
  void cleanup();
  const interval = setInterval(cleanup, 24 * 60 * 60 * 1000);
  interval.unref?.();
  const eventCleanup = setInterval(
    () => {
      void cleanupRealtimeEvents().catch((error) =>
        console.error("Realtime retention:", error),
      );
    },
    60 * 60 * 1000,
  );
  eventCleanup.unref?.();
});
