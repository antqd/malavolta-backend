import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

import trattoriRoutes from "./routes/trattori.js";

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  const [rows] = await pool.query(
    "SELECT id, email, password_hash, role FROM users WHERE email = ? LIMIT 1",
    [email]
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.password_hash || "");
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  const token = signToken({ id: user.id, role: user.role, email: user.email });

  return res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role },
  });
});

// GET /api/auth/me  (Bearer <token>)
router.get("/me", async (req, res) => {
  const [rows] = await pool.query(
    "SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1",
    [req.user.id]
  );
  const me = rows[0];
  if (!me) return res.status(404).json({ error: "User not found" });
  res.json({ user: me });
});

export default router;
