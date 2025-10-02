// src/routes/admins.js
import express from "express";
import bcrypt from "bcryptjs";
import { pool } from "../db.js";
import { recordAudit } from "../utils/audit.js";

const router = express.Router();

// POST /api/admins/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Tutti i campi sono obbligatori" });
    }

    // controlla se email già usata
    const [existing] = await pool.query("SELECT id FROM admins WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email già registrata" });
    }

    // hash password
    const hashed = await bcrypt.hash(password, 10);

    // inserisci nuovo admin
    const [result] = await pool.query(
      "INSERT INTO admins (name, email, password) VALUES (?, ?, ?)",
      [name, email, hashed]
    );

    await recordAudit(req, {
      action: "CREATE",
      entity: "admins",
      meta: { adminId: result.insertId, name, email },
    });

    res.json({
      id: result.insertId,
      name,
      email,
      createdAt: new Date(),
    });
  } catch (err) {
    console.error("POST /api/admins/register error:", err);
    res.status(500).json({ error: "Errore registrazione admin" });
  }
});

export default router;
