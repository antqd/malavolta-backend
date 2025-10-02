import jwt from "jsonwebtoken";
import { pool } from "../db.js";

const TOKEN_NAME = "auth_token";
const JWT_SECRET = process.env.JWT_SECRET || "cambia-questo-subito";

function extractUserFromReq(req) {
  const fromMiddleware = req?.user;
  if (fromMiddleware) {
    return {
      id: fromMiddleware.uid ?? fromMiddleware.id ?? null,
      email: fromMiddleware.email ?? fromMiddleware.user_email ?? null,
    };
  }

  const rawAuth = req?.headers?.authorization || "";
  const bearerToken = rawAuth.startsWith("Bearer ")
    ? rawAuth.slice(7)
    : rawAuth || null;
  const cookieToken = req?.cookies?.[TOKEN_NAME];
  const token = cookieToken || bearerToken;
  if (!token) return null;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return {
      id: payload.uid ?? payload.id ?? null,
      email: payload.email ?? null,
    };
  } catch {
    return null;
  }
}

function resolveIp(req) {
  const headerIp = req?.headers?.["x-forwarded-for"];
  if (headerIp) {
    const first = Array.isArray(headerIp) ? headerIp[0] : String(headerIp);
    if (first) return first.split(",")[0]?.trim() || null;
  }
  return req?.ip || req?.socket?.remoteAddress || null;
}

function serializeMeta(meta) {
  if (meta === undefined || meta === null) return null;
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return null;
  }
}

export async function recordAudit(req, details) {
  if (!details || !details.action || !details.entity) return;

  const reqUser = extractUserFromReq(req);
  const userId = details.userId ?? reqUser?.id ?? null;
  const userEmail = details.userEmail ?? reqUser?.email ?? null;
  const userAgent = req?.get?.("user-agent") || req?.headers?.["user-agent"] || null;
  const ip = resolveIp(req);
  const meta = serializeMeta(details.meta);

  try {
    await pool.query(
      `INSERT INTO audit_log (action, entity, meta, user_id, user_email, ip, ua, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        details.action,
        details.entity,
        meta,
        userId,
        userEmail,
        ip,
        userAgent,
        userAgent,
      ]
    );
  } catch (err) {
    console.error("Audit log insert error", err);
  }
}
