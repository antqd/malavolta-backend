import { Router } from "express";
import { pool } from "../db.js";

const router = Router();

function toInt(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : d;
}
function euroToCents(v) {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// factory per CRUD su una tabella
function crudFor(table) {
  const r = Router();

  // LIST
  r.get("/", async (req, res) => {
    const q = (req.query.q || "").trim();
    const page = Math.max(1, toInt(req.query.page, 1));
    const take = Math.min(50, Math.max(1, toInt(req.query.take, 12)));
    const offset = (page - 1) * take;

    const where = [];
    const params = [];
    if (q) { where.push("(name LIKE ? OR description LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM ${table} ${whereSql}`, params);
    const [rows] = await pool.query(
      `SELECT id, name, photo_url, description, price_cents, quantity, created_at
       FROM ${table} ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`, [...params, take, offset]
    );
    res.json({ items: rows, total, page, take });
  });

  // GET by id
  r.get("/:id", async (req, res) => {
    const id = toInt(req.params.id);
    const [rows] = await pool.query(
      `SELECT id, name, photo_url, description, price_cents, quantity, created_at
       FROM ${table} WHERE id = ? LIMIT 1`, [id]
    );
    if (!rows.length) return res.status(404).json({ error: "Not found" });
    res.json(rows[0]);
  });

  // CREATE
  r.post("/", async (req, res) => {
    const { name, photo, description, price, quantity } = req.body || {};
    if (!name) return res.status(400).json({ error: "name is required" });
    const price_cents = Number.isFinite(price) ? price : euroToCents(price);
    const qty = toInt(quantity, 0);
    const [r2] = await pool.query(
      `INSERT INTO ${table} (name, photo_url, description, price_cents, quantity)
       VALUES (?, ?, ?, ?, ?)`,
      [name, photo || null, description || null, price_cents, qty]
    );
    const newId = r2.insertId;
    const [row] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [newId]);
    res.status(201).json(row[0]);
  });

  // UPDATE
  r.patch("/:id", async (req, res) => {
    const id = toInt(req.params.id);
    const sets = [], params = [];
    if ("name" in req.body) { sets.push("name = ?"); params.push(req.body.name || null); }
    if ("photo" in req.body) { sets.push("photo_url = ?"); params.push(req.body.photo || null); }
    if ("description" in req.body) { sets.push("description = ?"); params.push(req.body.description || null); }
    if ("price" in req.body) { sets.push("price_cents = ?"); params.push(euroToCents(req.body.price)); }
    if ("quantity" in req.body) { sets.push("quantity = ?"); params.push(toInt(req.body.quantity, 0)); }
    if (sets.length) {
      params.push(id);
      await pool.query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = ?`, params);
    }
    const [row] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (!row.length) return res.status(404).json({ error: "Not found" });
    res.json(row[0]);
  });

  // DELETE
  r.delete("/:id", async (req, res) => {
    const id = toInt(req.params.id);
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    res.status(204).end();
  });

  return r;
}

// monta due router separati
router.use("/nuovi", crudFor("trattori_nuovi"));
router.use("/usati", crudFor("trattori_usati"));

export default router;
