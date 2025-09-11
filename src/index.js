// src/index.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
dotenv.config();

import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import categoryRoutes from "./routes/categories.js";
import serviceRoutes from "./routes/services.js";
import blogRoutes from "./routes/blog.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/blog", blogRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server http://localhost:${PORT}`));
