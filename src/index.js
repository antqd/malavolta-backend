import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

import trattoriRoutes from "./routes/trattori.js";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";

const app = express();
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());

// health
app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, db: "up" });
});

// === mount APIs ===
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/trattori", trattoriRoutes);

// error handler JSON (evita HTML)
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log("Backend on port", PORT));
