// src/routes/auth.js (ESM) — login/register senza ruoli + cookie cross-site “hard”
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { recordAudit } from "../utils/audit.js";

const router = Router();

const TOKEN_NAME = "auth_token";
const JWT_SECRET = process.env.JWT_SECRET || "cambia-questo-subito";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 giorni

function signJwt(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE });
}
function verifyJwt(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

const IS_PROD = String(process.env.NODE_ENV).toLowerCase() === "production";
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined; // .alfonsomalavolta.com in prod

function cookieForProd() {
  return {
    httpOnly: true,
    sameSite: "none", // cross-site OK
    secure: true, // richiesto se SameSite=None
    domain: COOKIE_DOMAIN, // .alfonsomalavolta.com
    path: "/",
    maxAge: MAX_AGE * 1000,
  };
}
function cookieForDev() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: MAX_AGE * 1000,
  };
}
const buildCookieOpts = () => (IS_PROD ? cookieForProd() : cookieForDev());

// --- PING
router.get("/__ping", (_req, res) => res.json({ ok: true, scope: "auth" }));

// Helpers
async function getUserByEmail(email) {
  const [rows] = await pool.execute(
    `SELECT id, name, email, password AS passwordHash, created_at AS createdAt
     FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}
async function getUserById(id) {
  const [rows] = await pool.execute(
    `SELECT id, name, email, created_at AS createdAt FROM users WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || name.trim().length < 2)
      return res.status(400).json({ error: "Nome non valido" });
    if (!email || !/^\S+@\S+\.\S+$/.test(email))
      return res.status(400).json({ error: "Email non valida" });
    if (!password || password.length < 8)
      return res.status(400).json({ error: "Password troppo corta (min 8)" });

    const exists = await getUserByEmail(email.toLowerCase());
    if (exists) return res.status(409).json({ error: "Email già registrata" });

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name.trim(), email.toLowerCase(), hash]
    );
    const user = await getUserById(result.insertId);

    const token = signJwt({ uid: user.id, email: user.email });
    res.cookie(TOKEN_NAME, token, buildCookieOpts());
    await recordAudit(req, {
      action: "REGISTER",
      entity: "users",
      meta: { userId: user.id, email: user.email },
    });
    return res.status(201).json({ user });
  } catch (err) {
    console.error("register error", err);
    return res.status(500).json({ error: "Errore server" });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Credenziali mancanti" });

    const user = await getUserByEmail(email.toLowerCase());
    if (!user)
      return res.status(401).json({ error: "Email o password errati" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Email o password errati" });

    const token = signJwt({ uid: user.id, email: user.email });
    res.cookie(TOKEN_NAME, token, buildCookieOpts());
    await recordAudit(req, {
      action: "LOGIN",
      entity: "auth",
      meta: { userId: user.id, email: user.email },
    });
    return res.json({
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("login error", err);
    return res.status(500).json({ error: "Errore server" });
  }
});

// ME
router.get("/me", async (req, res) => {
  const token = req.cookies?.[TOKEN_NAME];
  const payload = token ? verifyJwt(token) : null;
  if (!payload) return res.status(401).json({ error: "Non autenticato" });
  const user = await getUserById(payload.uid);
  if (!user) return res.status(401).json({ error: "Sessione non valida" });
  return res.json({ user });
});

// LOGOUT
router.post("/logout", async (req, res) => {
  res.clearCookie(TOKEN_NAME, { ...buildCookieOpts(), maxAge: 0 });
  await recordAudit(req, {
    action: "LOGOUT",
    entity: "auth",
    meta: { ok: true },
  });
  return res.json({ ok: true });
});

export default router;
