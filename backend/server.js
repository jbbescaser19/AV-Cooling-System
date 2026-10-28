import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

import authRoutes from "./routes/customer/authRoutes.js";
import customerAccountRoutes from "./routes/customer/accountRoutes.js";

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
app.use("/api/customer/account", customerAccountRoutes);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
