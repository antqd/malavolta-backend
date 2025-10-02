import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

const router = Router();

// GET /api/brands
router.get("/", async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM brands ORDER BY name ASC");
  res.json(rows);
});

// POST /api/brands (ADMIN)
router.post("/", requireAdmin, async (req, res) => {
  const { name, slug, logo_media_id } = req.body;
  if (!name || !slug) return res.status(400).json({ error: "name and slug required" });

  const [result] = await pool.query(
    "INSERT INTO brands (name, slug, logo_media_id) VALUES (?, ?, ?)",
    [name, slug, logo_media_id ?? null]
  );

  const [rows] = await pool.query("SELECT * FROM brands WHERE id = ?", [result.insertId]);
  await recordAudit(req, {
    action: "CREATE",
    entity: "brands",
    meta: {
      brandId: result.insertId,
      name,
      slug,
      logoMediaId: logo_media_id ?? null,
    },
  });
  res.status(201).json(rows[0]);
});

// PATCH /api/brands/:id (ADMIN)
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const fields = ["name", "slug", "logo_media_id"];
  const sets = [];
  const params = [];
  const changes = {};

  for (const f of fields) {
    if (f in req.body) {
      sets.push(`${f} = ?`);
      const value = req.body[f] ?? null;
      params.push(value);
      changes[f] = value;
    }
  }

  if (!sets.length) return res.status(400).json({ error: "No fields to update" });
  params.push(id);

  await pool.query(`UPDATE brands SET ${sets.join(", ")} WHERE id = ?`, params);

  const [rows] = await pool.query("SELECT * FROM brands WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).json({ error: "Brand not found" });

  await recordAudit(req, {
    action: "UPDATE",
    entity: "brands",
    meta: { brandId: Number(id) || id, changes },
  });
  res.json(rows[0]);
});

// DELETE /api/brands/:id (ADMIN)
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  await pool.query("DELETE FROM brands WHERE id = ?", [id]);
  await recordAudit(req, {
    action: "DELETE",
    entity: "brands",
    meta: { brandId: Number(id) || id },
  });
  res.status(204).end();
});

export default router;
