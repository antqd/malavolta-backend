// src/routes/audit.js (ESM)
import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

// helper: se meta è JSON string/colonna JSON lo parse-iamo safe
function parseMeta(meta) {
  if (meta == null) return null;
  if (typeof meta === "object") return meta; // già JSON (MySQL JSON)
  try {
    return JSON.parse(meta);
  } catch {
    return null;
  }
}

// GET /api/audit
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT action, entity, meta, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT 100`
    );

    const items = rows.map((r) => ({
      action: r.action,
      entity: r.entity,
      meta: parseMeta(r.meta),
      createdAt: r.created_at,
    }));

    res.json({ items, total: items.length });
  } catch (err) {
    console.error("GET /api/audit error:", err);
    res.status(500).json({ error: "Errore nel recupero audit log" });
  }
});

export default router;
