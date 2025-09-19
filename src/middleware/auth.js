import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "DEV_CHANGE_ME_please_123";

function extractToken(req) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data; // { id, role, email, name }
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export function requireAdmin(req, res, next) {
  // verifica token se non già verificato
  if (!req.user) {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: "Not authenticated" });
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: "Invalid token" });
    }
  }
  const role = (req.user.role || "").toUpperCase();
  if (role !== "ADMIN") return res.status(403).json({ error: "Forbidden" });
  next();
}
