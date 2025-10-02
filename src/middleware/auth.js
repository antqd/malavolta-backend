import jwt from "jsonwebtoken";
const TOKEN_NAME = "auth_token";
const JWT_SECRET = process.env.JWT_SECRET || "1234"; // Cambia questo in produzione

// Middleware per proteggere le rotte

export function requireAuth(req, res, next) {
  const token = req.cookies?.[TOKEN_NAME];
  if (!token) return res.status(401).json({ error: "Non autenticato" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { uid, email, role, iat, exp }
    next();
  } catch {
    return res.status(401).json({ error: "Sessione scaduta o non valida" });
  }
}
