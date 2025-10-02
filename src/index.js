// src/index.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import path from "path";
import multer from "multer";

import trattoriRoutes from "./routes/trattori.js";
import authRoutes from "./routes/auth.js"; 
import usersRoutes from "./routes/users.js";   
import auditRoutes from "./routes/audit.js";   
import adminsRoutes from "./routes/admins.js";   // 👈 aggiunto
import { recordAudit } from "./utils/audit.js";

dotenv.config();

const app = express();
app.set("trust proxy", 1);

// ---------- CORS ----------
const STATIC_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://185.229.239.141",
  "https://api.alfonsomalavolta.com",
  "https://www.alfonsomalavolta.com",
  "https://admin.alfonsomalavolta.com",
  "https://malavolta-admin.vercel.app",
];
const ENV_ORIGINS = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = [...new Set([...STATIC_ORIGINS, ...ENV_ORIGINS])];
import { pool } from "./db.js";

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.options("*", cors());

// ---------- PARSER ----------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ---------- STATIC ----------
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/api/health/db", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT 1 AS ok");
    res.json({ ok: true, db: rows[0]?.ok });
  } catch (err) {
    console.error("DB Health error:", err);
    res
      .status(500)
      .json({ ok: false, code: err.code, message: err.message });
  }
});

// ---------- HEALTH ----------
app.get("/api/health", (_req, res) => res.json({ ok: true, db: "up" }));
app.get("/api/test", (_req, res) => res.json({ ok: true, db: "up" }));

// ---------- ROUTES ----------
app.use("/api/auth", authRoutes);
app.use("/api/trattori", trattoriRoutes);
app.use("/api/users", usersRoutes);   
app.use("/api/audit", auditRoutes);   
app.use("/api/admins", adminsRoutes);   // 👈 nuova route admins

// ---------- UPLOAD ----------
const storage = multer.diskStorage({
  destination: (_req, _file, cb) =>
    cb(null, path.join(process.cwd(), "uploads")),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safe = Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    cb(null, safe);
  },
});
function imageFilter(_req, file, cb) {
  if ((file.mimetype || "").startsWith("image/")) return cb(null, true);
  cb(new Error("Solo immagini permesse"), false);
}
const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Nessun file" });
  const url = `/uploads/${req.file.filename}`;
  await recordAudit(req, {
    action: "UPLOAD",
    entity: "media",
    meta: {
      filename: req.file.filename,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });
  res.json({ url });
});

// ---------- ERROR HANDLER ----------
app.use((err, _req, res, _next) => {
  console.error("❌ Errore:", err.message);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "CORS: origin non consentita" });
  }
  res.status(500).json({ error: "Internal Server Error" });
});

// ---------- START ----------
const PORT = process.env.PORT || 4000;
app.listen(PORT, () =>
  console.log(`✅ Backend avviato → http://localhost:${PORT}`)
);
