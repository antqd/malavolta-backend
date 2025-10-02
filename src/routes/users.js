// src/routes/users.js
import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

/**
 * GET /api/users
 * Facoltativo: ?page=1&take=50
 */
router.get("/", async (req, res) => {
  try {
    const take = Math.min(parseInt(req.query.take, 10) || 50, 100);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const offset = (page - 1) * take;

    const [rows] = await pool.query(
      `SELECT id, name, email, created_at AS createdAt
       FROM users
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [take, offset]
    );

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM users`);
    const total = countRows[0]?.total ?? 0;

    res.json({
      items: rows,
      pagination: { page, take, total, pages: Math.ceil(total / take) },
    });
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "Errore nel recupero utenti" });
  }
});

/**
 * GET /api/users/:id
 */
router.get("/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query(
      `SELECT id, name, email, created_at AS createdAt
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: "Utente non trovato" });
    res.json({ user });
  } catch (err) {
    console.error("GET /api/users/:id error:", err);
    res.status(500).json({ error: "Errore nel recupero utente" });
  }
});

export default router;
