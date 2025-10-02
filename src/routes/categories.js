import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { recordAudit } from "../utils/audit.js";

const router = Router();

// GET /api/categories
router.get("/", async (_req, res) => {
  const [rows] = await pool.query("SELECT * FROM categories ORDER BY name_it ASC");
  res.json(rows);
});

// POST /api/categories (ADMIN)
router.post("/", requireAdmin, async (req, res) => {
  const { name_it, name_en, slug } = req.body;
  if (!name_it || !name_en || !slug) return res.status(400).json({ error: "name_it, name_en, slug required" });

  const [result] = await pool.query(
    "INSERT INTO categories (name_it, name_en, slug) VALUES (?, ?, ?)",
    [name_it, name_en, slug]
  );

  const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [result.insertId]);
  await recordAudit(req, {
    action: "CREATE",
    entity: "categories",
    meta: {
      categoryId: result.insertId,
      name_it,
      name_en,
      slug,
    },
  });
  res.status(201).json(rows[0]);
});

// PATCH /api/categories/:id (ADMIN)
router.patch("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const fields = ["name_it", "name_en", "slug"];
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

  await pool.query(`UPDATE categories SET ${sets.join(", ")} WHERE id = ?`, params);

  const [rows] = await pool.query("SELECT * FROM categories WHERE id = ?", [id]);
  if (!rows.length) return res.status(404).json({ error: "Category not found" });

  await recordAudit(req, {
    action: "UPDATE",
    entity: "categories",
    meta: { categoryId: Number(id) || id, changes },
  });
  res.json(rows[0]);
});

// DELETE /api/categories/:id (ADMIN)
router.delete("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  await pool.query("DELETE FROM categories WHERE id = ?", [id]);
  await recordAudit(req, {
    action: "DELETE",
    entity: "categories",
    meta: { categoryId: Number(id) || id },
  });
  res.status(204).end();
});

export default router;
