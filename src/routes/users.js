// src/routes/users.js
const express = require("express");
const { query } = require("../db");

const router = express.Router();

// GET /api/users
// Ritorna name, email e created_at come "aggiunto nel giorno: DD/MM/YYYY"
router.get("/", async (_req, res) => {
  try {
    const rows = await query(`
      SELECT name, email, created_at
      FROM users
      ORDER BY created_at DESC
    `);

    const items = rows.map((u) => {
      const d = new Date(u.created_at);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return {
        name: u.name,
        email: u.email,
        createdAt: u.created_at,
        addedOnDay: `aggiunto nel giorno: ${dd}/${mm}/${yyyy}`,
      };
    });

    res.json({ items, total: items.length });
  } catch (err) {
    console.error("GET /api/users error:", err);
    res.status(500).json({ error: "Errore nel recupero utenti" });
  }
});

module.exports = router;
