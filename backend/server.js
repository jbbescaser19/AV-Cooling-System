import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/customer/authRoutes.js";
import accountRoutes from "./routes/customer/accountRoutes.js";
import serviceRoutes from "./routes/customer/serviceRoutes.js";
import cartRoutes from "./routes/customer/cartRoutes.js";
import orderRoutes from "./routes/customer/orderRoutes.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(helmet());

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth/customer", authRoutes);
app.use("/api/customer/account", accountRoutes);
app.use("/api/customer/services", serviceRoutes);
app.use("/api/customer/cart", cartRoutes);
app.use("/api/customer/orders", orderRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
