// src/routes/audit.js
const express = require("express");
const { query } = require("../db");

const router = express.Router();

// GET /api/audit
// Ritorna tutti i movimenti registrati nella tabella audit_log
router.get("/", async (_req, res) => {
  try {
    const rows = await query(`
      SELECT action, entity, meta, created_at
      FROM audit_log
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const items = rows.map((r) => ({
      action: r.action,
      entity: r.entity,
      meta: r.meta ? JSON.parse(r.meta) : null,
      createdAt: r.created_at,
    }));

    res.json({ items, total: items.length });
  } catch (err) {
    console.error("GET /api/audit error:", err);
    res.status(500).json({ error: "Errore nel recupero audit log" });
  }
});

module.exports = router;
