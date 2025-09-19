// src/routes/auth.js
import { Router } from "express";
import { pool } from "../db.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

const TOKEN_NAME = "token";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 giorni
};

// Helpers
function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });
}
function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

/** POST /api/auth/register */
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email e password sono obbligatori" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "La password deve avere almeno 8 caratteri" });
    }

    // email unica
    const [exists] = await pool.query("SELECT id FROM users WHERE email = ? LIMIT 1", [email]);
    if (exists.length) return res.status(409).json({ error: "Email già registrata" });

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'user')",
      [name, email, hash]
    );

    const user = { id: result.insertId, name, email, role: "user" };
    const token = signToken({ id: user.id, email: user.email, role: user.role });

    res.cookie(TOKEN_NAME, token, COOKIE_OPTS);
    return res.status(201).json({ ok: true, user });
  } catch (err) {
    console.error("REGISTER ERROR", err);
    return res.status(500).json({ error: "Errore server" });
  }
});

/** POST /api/auth/login */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email e password obbligatorie" });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ? LIMIT 1", [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: "Credenziali non valide" });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Credenziali non valide" });

    const token = signToken({ id: user.id, email: user.email, role: user.role });
    res.cookie(TOKEN_NAME, token, COOKIE_OPTS);
    return res.json({ ok: true, user: publicUser(user) });
  } catch (err) {
    console.error("LOGIN ERROR", err);
    return res.status(500).json({ error: "Errore server" });
  }
});

/** GET /api/auth/me (protetta) */
router.get("/me", requireAuth, async (req, res) => {
  // req.user arriva dal middleware (payload del JWT)
  const [rows] = await pool.query("SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1", [
    req.user.id,
  ]);
  const me = rows[0];
  return res.json({ ok: true, user: me });
});

/** POST /api/auth/logout */
router.post("/logout", (_req, res) => {
  res.clearCookie(TOKEN_NAME);
  return res.json({ ok: true });
});

export default router;
