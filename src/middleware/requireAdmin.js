import dotenv from "dotenv"
dotenv.config()

export function requireAdmin(req, res, next) {
  const adminKey = req.headers["x-admin-key"];
  const expectedKey = process.env.ADMIN_SECRET;
  if (!adminKey || adminKey !== expectedKey) {
    console.warn("[ADMIN] Unauthorized: received=", adminKey, "expected=", expectedKey);
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}
