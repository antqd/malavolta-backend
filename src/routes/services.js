// src/routes/services.js
import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { getPagination, shapeList } from "../utils/pagination.js";
import { recordAudit } from "../utils/audit.js";

const router = Router();

router.get("/", async (req, res) => {
  const { q, status } = req.query;
  const { page, limit, offset, take } = getPagination(req.query.page, 12);

  const where = [];
  const params = [];
  if (q) { where.push("(title_it LIKE ? OR slug LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
  if (status) { where.push("status = ?"); params.push(String(status)); }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM services${whereSql}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT * FROM services${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json(shapeList(rows, total, page, take));
});

router.post("/", requireAdmin, async (req, res) => {
  const { slug, title_it, title_en, content_it, content_en, cover_media_id, status } = req.body;
  if (!slug || !title_it || !content_it) return res.status(400).json({ error: "slug, title_it, content_it required" });

  const [result] = await pool.query(
    `INSERT INTO services (slug, title_it, title_en, content_it, content_en, cover_media_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [slug, title_it, title_en ?? null, content_it, content_en ?? null, cover_media_id ?? null, status || "DRAFT"]
  );
  const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [result.insertId]);
  await recordAudit(req, {
    action: "CREATE",
    entity: "services",
    meta: {
      serviceId: result.insertId,
      slug,
      title_it,
      status: rows[0]?.status ?? status ?? "DRAFT",
    },
  });
  res.status(201).json(rows[0]);
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const fields = ["slug","title_it","title_en","content_it","content_en","cover_media_id","status"];
  const sets = [];
  const params = [];
  const changes = {};
  for (const f of fields) {
    if (f in req.body) {
      const value = req.body[f] ?? null;
      sets.push(`${f} = ?`);
      params.push(value);
      changes[f] = value;
    }
  }
  if (!sets.length) return res.status(400).json({ error: "No fields to update" });
  params.push(id);
  await pool.query(`UPDATE services SET ${sets.join(", ")} WHERE id = ?`, params);
  const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).json({ error: "Service not found" });

  await recordAudit(req, {
    action: "UPDATE",
    entity: "services",
    meta: { serviceId: Number(id) || id, changes },
  });
  res.json(rows[0]);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  await pool.query("DELETE FROM services WHERE id = ?", [id]);
  await recordAudit(req, {
    action: "DELETE",
    entity: "services",
    meta: { serviceId: Number(id) || id },
  });
  res.status(204).end();
});

export default router;
