// src/routes/products.js
import { Router } from "express";
import { pool } from "../db.js";
import { recordAudit } from "../utils/audit.js";
// import { requireAdmin } from "../middleware/auth.js"; // disabilitato per ora
import { getPagination, shapeList } from "../utils/pagination.js";

const router = Router();

function parseBool(v) {
  if (v === undefined || v === null) return undefined;
  return String(v) === "true";
}

async function ensureIdExists(table, id) {
  if (id == null) return null;
  const n = Number(id);
  if (!Number.isFinite(n) || n <= 0) return null;
  const [rows] = await pool.query(
    `SELECT id FROM ${table} WHERE id = ? LIMIT 1`,
    [n]
  );
  return rows.length ? n : null;
}

// GET /api/products
router.get("/", async (req, res) => {
  const {
    q,
    brandId,
    categoryId,
    used,
    status,
    priceMin,
    priceMax,
    yearMin,
    yearMax,
  } = req.query;
  const { page, limit, offset, take } = getPagination(req.query.page, 12);

  const where = [];
  const params = [];

  if (q) {
    where.push("(title_it LIKE ? OR slug LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }
  if (brandId) {
    where.push("brand_id = ?");
    params.push(Number(brandId));
  }
  if (categoryId) {
    where.push("category_id = ?");
    params.push(Number(categoryId));
  }
  if (used !== undefined) {
    where.push("used = ?");
    params.push(parseBool(used) ? 1 : 0);
  }
  if (status) {
    where.push("status = ?");
    params.push(String(status));
  }
  if (priceMin) {
    where.push("price_cents >= ?");
    params.push(Number(priceMin));
  }
  if (priceMax) {
    where.push("price_cents <= ?");
    params.push(Number(priceMax));
  }
  if (yearMin) {
    where.push("year >= ?");
    params.push(Number(yearMin));
  }
  if (yearMax) {
    where.push("year <= ?");
    params.push(Number(yearMax));
  }

  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM products${whereSql}`,
    params
  );

  const [rows] = await pool.query(
    `SELECT * FROM products${whereSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  if (!rows.length) return res.json(shapeList([], total, page, take));

  const productIds = rows.map((r) => r.id);
  const brandIds = rows.map((r) => r.brand_id).filter(Boolean);
  const categoryIds = rows.map((r) => r.category_id).filter(Boolean);

  const [brandRows] = brandIds.length
    ? await pool.query(
        `SELECT * FROM brands WHERE id IN (${brandIds
          .map(() => "?")
          .join(",")})`,
        brandIds
      )
    : [[]];
  const [catRows] = categoryIds.length
    ? await pool.query(
        `SELECT * FROM categories WHERE id IN (${categoryIds
          .map(() => "?")
          .join(",")})`,
        categoryIds
      )
    : [[]];

  const [imgRows] = productIds.length
    ? await pool.query(
        `SELECT pi.id, pi.product_id, pi.\`order\`, m.url
         FROM product_images pi
         LEFT JOIN media m ON m.id = pi.media_id
         WHERE pi.product_id IN (${productIds.map(() => "?").join(",")})
         ORDER BY pi.\`order\` ASC`,
        productIds
      )
    : [[]];

  const brandMap = Object.fromEntries(brandRows.map((b) => [b.id, b]));
  const catMap = Object.fromEntries(catRows.map((c) => [c.id, c]));
  const imagesByProduct = {};
  for (const r of imgRows) {
    if (!imagesByProduct[r.product_id]) imagesByProduct[r.product_id] = [];
    imagesByProduct[r.product_id].push({
      id: r.id,
      order: r.order,
      media: { url: r.url },
    });
  }

  const items = rows.map((r) => ({
    ...r,
    brand: r.brand_id ? brandMap[r.brand_id] || null : null,
    category: r.category_id ? catMap[r.category_id] || null : null,
    images: imagesByProduct[r.id] || [],
  }));

  res.json(shapeList(items, total, page, take));
});

// GET /api/products/:id
router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [rows] = await pool.query(
    "SELECT * FROM products WHERE id = ? LIMIT 1",
    [id]
  );
  const prod = rows[0];
  if (!prod) return res.status(404).json({ error: "Product not found" });

  const [brandRow] = prod.brand_id
    ? await pool.query("SELECT * FROM brands WHERE id = ?", [prod.brand_id])
    : [[null]];
  const [catRow] = prod.category_id
    ? await pool.query("SELECT * FROM categories WHERE id = ?", [
        prod.category_id,
      ])
    : [[null]];
  const [imgs] = await pool.query(
    `SELECT pi.id, pi.\`order\`, m.url
     FROM product_images pi
     LEFT JOIN media m ON m.id = pi.media_id
     WHERE pi.product_id = ?
     ORDER BY pi.\`order\` ASC`,
    [prod.id]
  );

  res.json({
    ...prod,
    brand: brandRow[0] || null,
    category: catRow[0] || null,
    images: imgs.map((i) => ({
      id: i.id,
      order: i.order,
      media: { url: i.url },
    })),
  });
});

// POST /api/products   body: { ..., images:[{url,order}] }
router.post(
  "/",
  /* requireAdmin, */ async (req, res) => {
    const {
      slug,
      title_it,
      title_en,
      description_it,
      description_en,
      brand_id,
      category_id,
      year,
      power_cv,
      price_cents,
      used,
      features,
      status,
      images,
    } = req.body;

    if (!slug) return res.status(400).json({ error: "slug is required" });

    // ✅ se brand/category non esistono → null (evita FK error)
    const safeBrandId = await ensureIdExists("brands", brand_id);
    const safeCategoryId = await ensureIdExists("categories", category_id);

    const [result] = await pool.query(
      `INSERT INTO products
     (slug, title_it, title_en, description_it, description_en,
      brand_id, category_id, year, power_cv, price_cents, used, features, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        slug,
        title_it ?? null,
        title_en ?? null,
        description_it ?? null,
        description_en ?? null,
        safeBrandId, // <- safe
        safeCategoryId, // <- safe
        year ?? null,
        power_cv ?? null,
        price_cents ?? null,
        used ? 1 : 0,
        features ? JSON.stringify(features) : null,
        status || "DRAFT",
      ]
    );
    const newId = result.insertId;

    if (Array.isArray(images) && images.length) {
      for (const img of images) {
        const [mRes] = await pool.query("INSERT INTO media (url) VALUES (?)", [
          img.url,
        ]);
        const mediaId = mRes.insertId;
        await pool.query(
          "INSERT INTO product_images (product_id, media_id, `order`) VALUES (?, ?, ?)",
          [newId, mediaId, img.order ?? 0]
        );
      }
    }

    const [row] = await pool.query("SELECT * FROM products WHERE id = ?", [
      newId,
    ]);
    await recordAudit(req, {
      action: "CREATE",
      entity: "products",
      meta: {
        productId: newId,
        slug,
        brandId: safeBrandId,
        categoryId: safeCategoryId,
        status: row[0]?.status ?? status ?? "DRAFT",
        imagesCount: Array.isArray(images) ? images.length : 0,
      },
    });
    res.status(201).json(row[0]);
  }
);

// PATCH /api/products/:id
router.patch(
  "/:id",
  /* requireAdmin, */ async (req, res) => {
    const id = Number(req.params.id);
    const fields = [
      "slug",
      "title_it",
      "title_en",
      "description_it",
      "description_en",
      "brand_id",
      "category_id",
      "year",
      "power_cv",
      "price_cents",
      "used",
      "features",
      "status",
    ];
    const sets = [];
    const params = [];
    const changes = {};

    // ✅ normalizza brand/category se presenti
    if ("brand_id" in req.body) {
      const safeBrandId = await ensureIdExists("brands", req.body.brand_id);
      sets.push("brand_id = ?");
      params.push(safeBrandId);
      changes.brand_id = safeBrandId;
    }
    if ("category_id" in req.body) {
      const safeCategoryId = await ensureIdExists(
        "categories",
        req.body.category_id
      );
      sets.push("category_id = ?");
      params.push(safeCategoryId);
      changes.category_id = safeCategoryId;
    }

    for (const f of fields) {
      if (f === "brand_id" || f === "category_id") continue; // già gestiti sopra
      if (f in req.body) {
        if (
          f === "features" &&
          req.body[f] &&
          typeof req.body[f] === "object"
        ) {
          sets.push(`${f} = ?`);
          params.push(JSON.stringify(req.body[f]));
          changes[f] = req.body[f];
        } else if (f === "used") {
          sets.push(`${f} = ?`);
          params.push(req.body[f] ? 1 : 0);
          changes[f] = req.body[f] ? 1 : 0;
        } else {
          sets.push(`${f} = ?`);
          params.push(req.body[f] ?? null);
          changes[f] = req.body[f] ?? null;
        }
      }
    }

    if (sets.length) {
      params.push(id);
      await pool.query(
        `UPDATE products SET ${sets.join(", ")} WHERE id = ?`,
        params
      );
    }

    if (Array.isArray(req.body.images)) {
      await pool.query("DELETE FROM product_images WHERE product_id = ?", [id]);
      for (const img of req.body.images) {
        const [mRes] = await pool.query("INSERT INTO media (url) VALUES (?)", [
          img.url,
        ]);
        await pool.query(
          "INSERT INTO product_images (product_id, media_id, `order`) VALUES (?, ?, ?)",
          [id, mRes.insertId, img.order ?? 0]
        );
      }
      changes.images = req.body.images.map((img) => ({
        url: img.url,
        order: img.order ?? 0,
      }));
    }

    const [row] = await pool.query("SELECT * FROM products WHERE id = ?", [id]);
    if (!row.length)
      return res.status(404).json({ error: "Product not found" });
    if (Object.keys(changes).length) {
      await recordAudit(req, {
        action: "UPDATE",
        entity: "products",
        meta: { productId: id, changes },
      });
    }
    res.json(row[0]);
  }
);

// DELETE /api/products/:id
router.delete(
  "/:id",
  /* requireAdmin, */ async (req, res) => {
    const id = Number(req.params.id);
    await pool.query("DELETE FROM product_images WHERE product_id = ?", [id]);
    await pool.query("DELETE FROM products WHERE id = ?", [id]);
    await recordAudit(req, {
      action: "DELETE",
      entity: "products",
      meta: { productId: id },
    });
    res.status(204).end();
  }
);

export default router;
