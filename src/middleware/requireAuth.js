// src/middleware/requireAuth.js
import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  const token = req.cookies?.token; // stesso nome usato in auth.js
  if (!token) return res.status(401).json({ error: "Non autenticato" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, email, role, iat, exp }
    next();
  } catch {
    return res.status(401).json({ error: "Token non valido" });
  }
}
