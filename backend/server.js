import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

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

app.use(express.json());
app.use(cookieParser());

app.use("/api/catalog", publicCatalogRoutes);
app.use("/api/schedule", bookingScheduleRoutes);
app.use("/api/auth/customer", authRoutes);
app.use("/api/customer/account", accountRoutes);
app.use("/api/customer/services", serviceRoutes);
app.use("/api/customer/cart", cartRoutes);
app.use("/api/customer/orders", orderRoutes);
app.use("/api/customer/notifications", notificationRoutes);
app.use("/api/customer/feedback", feedbackRoutes);
app.use("/api/management/auth", managementAuthRoutes);
app.use("/api/management/schedule", managementBookingScheduleRoutes);
app.use("/api/management/dashboard", managementDashboardRoutes);
app.use("/api/management/sales", managementSalesRoutes);
app.use("/api/management/workspace", managementWorkspaceRoutes);
app.use("/api/management", managementOperationsRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
