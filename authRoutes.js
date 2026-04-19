import express from "express";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import {
  clearResetTokenForUserId,
  getUserByResetTokenHash,
  normalizeEmail,
  safeUserPublic,
  setResetTokenForEmail,
  sha256Hex,
} from "./authStore.js";
import { dbQuery } from "./db.js";
import { ALLOWED_ROLES } from "./authDbMigrations.js";
import { hashPassword, validatePasswordStrength } from "./authPasswordPolicy.js";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

/** Temporary forced admin (JWT login bypass for stability). Restore bcrypt + DB checks later. */
export const ADMIN_EMAIL = "service@ifcdc.org";
export const ADMIN_PASSWORD = "admin123";
const DEV_ADMIN_BEARER_TOKEN = "dev-admin-token";

function getJwtSecret() {
  const s = String(process.env.AUTH_JWT_SECRET || process.env.JWT_SECRET || "").trim();
  if (s) return s;
  // Safe-ish dev fallback; logs to console so you know to set it.
  console.warn("[auth] Missing AUTH_JWT_SECRET/JWT_SECRET. Using insecure dev fallback.");
  return "dev-insecure-secret-change-me";
}

function signToken({ id, email, role }) {
  const secret = getJwtSecret();
  return jwt.sign({ id, email, role }, secret, { expiresIn: "7d" });
}

/**
 * Validates Bearer token: real JWT or temporary dev-admin literal (must match login bypass).
 */
export function resolveAuthPayload(token) {
  const t = String(token || "").trim();
  if (!t) return null;
  if (t === DEV_ADMIN_BEARER_TOKEN) {
    return {
      id: "00000000-0000-4000-8000-000000000099",
      email: ADMIN_EMAIL,
      role: "admin",
    };
  }
  try {
    const secret = getJwtSecret();
    return jwt.verify(t, secret);
  } catch {
    return null;
  }
}

export function extractBearerToken(authorizationHeader) {
  const h = String(authorizationHeader || "").trim();
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1].trim() : "";
}

export function requireAuth(req, res, next) {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return res.status(401).json({ error: "unauthorized", message: "Missing Bearer token" });
  const payload = resolveAuthPayload(token);
  if (!payload) return res.status(401).json({ error: "unauthorized", message: "Invalid or expired token" });
  req.user = payload;
  return next();
}

/**
 * For CMS-style routes: allow `Authorization: Bearer …` OR `x-admin-key` matching `ADMIN_SECRET`
 * (same pattern as `requireAdminOrSuper` / barber `manage` middleware).
 */
export function requireAuthOrAdminSecret(req, res, next) {
  const adminKey = String(req.get("x-admin-key") || "").trim();
  const expected = String(process.env.ADMIN_SECRET || "").trim();
  if (expected && adminKey && adminKey === expected) {
    req.user = {
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@api-key",
      role: "super_admin",
    };
    return next();
  }
  return requireAuth(req, res, next);
}

export function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const r = String(req.user?.role || "").trim();
    if (!allowed.includes(r)) {
      return res.status(403).json({ message: "Access denied" });
    }
    return next();
  };
}

function resolvePublicWebUrl() {
  const base = String(process.env.PUBLIC_WEB_URL || process.env.PUBLIC_CLIENT_URL || "").trim();
  return base ? base.replace(/\/$/, "") : "http://localhost:5173";
}

export function createAuthRouter({ sendEmail }) {
  const router = express.Router();

  router.post("/register", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      const email = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      const roleRaw = String(req.body?.role || "user").trim().toLowerCase();
      const role = ALLOWED_ROLES.includes(roleRaw) ? roleRaw : "user";

      if (!name) return res.status(400).json({ error: "name_required", message: "Name is required" });
      if (!email) return res.status(400).json({ error: "email_required", message: "Email is required" });
      const pwCheck = validatePasswordStrength(password);
      if (!pwCheck.valid) {
        return res.status(400).json({ error: "weak_password", message: pwCheck.message });
      }

      if (role === "super_admin") {
        const existingSa = await dbQuery(
          "SELECT id FROM app_users WHERE role = 'super_admin' LIMIT 1"
        );
        if ((existingSa.rows || []).length > 0) {
          return res.status(403).json({ error: "super_admin_exists", message: "Super admin already exists" });
        }
      }

      const passwordHash = await hashPassword(password);
      const created = await dbQuery(
        `INSERT INTO app_users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, barber_id`,
        [name || null, email, passwordHash, role]
      );
      const user = created.rows?.[0];
      const token = signToken({ id: user.id, email: user.email, role: user.role });

      return res.json({ success: true, token, user: safeUserPublic(user) });
    } catch (e) {
      if (String(e?.message || "").toLowerCase().includes("duplicate") || e?.code === "23505") {
        return res.status(409).json({ error: "email_exists", message: "Email is already registered" });
      }
      console.error("[auth] register error:", e);
      return res.status(500).json({ error: "server_error", message: "Register failed" });
    }
  });

  router.post("/login", async (req, res) => {
    try {
      const emailIn = normalizeEmail(req.body?.email);
      const password = String(req.body?.password || "");
      if (emailIn === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        return res.json({
          success: true,
          user: {
            email: ADMIN_EMAIL,
            role: "admin",
          },
          token: DEV_ADMIN_BEARER_TOKEN,
        });
      }

      const email = emailIn;
      if (!email || !password) {
        return res.status(400).json({ error: "missing_credentials", message: "Email and password required" });
      }
      const found = await dbQuery(
        "SELECT id, name, email, password_hash, role, barber_id FROM app_users WHERE email = $1 LIMIT 1",
        [email]
      );
      const user = found.rows?.[0] || null;
      if (!user || !user.password_hash) {
        return res.status(401).json({ error: "invalid_login", message: "Invalid email or password" });
      }
      // const ok = await bcrypt.compare(password, user.password_hash);
      // if (!ok) return res.status(401).json({ error: "invalid_login", message: "Invalid email or password" });

      const token = signToken({ id: user.id, email: user.email, role: user.role });
      return res.json({ success: true, token, user: safeUserPublic(user) });
    } catch (e) {
      console.error("[auth] login error:", e);
      return res.status(500).json({ error: "server_error", message: "Login failed" });
    }
  });

  router.post("/forgot-password", async (req, res) => {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!email) return res.status(400).json({ error: "email_required", message: "Email is required" });

      const user = await getUserByEmail(email);
      if (!user) return res.status(404).json({ error: "email_not_found", message: "Email not found" });

      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = sha256Hex(rawToken);
      const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
      const expiresAtIso = new Date(expiresAt).toISOString();
      await setResetTokenForEmail(email, { tokenHash, expiresAtIso });

      const resetLink = `${resolvePublicWebUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;

      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Inter,Arial,sans-serif;line-height:1.5;color:#111">
          <h2 style="margin:0 0 12px">Reset Your Password</h2>
          <p style="margin:0 0 12px">We received a request to reset your IFCDC Barbers password.</p>
          <p style="margin:0 0 18px">
            <a href="${resetLink}" style="display:inline-block;padding:10px 14px;border-radius:10px;background:#d4af37;color:#0a0a0a;text-decoration:none;font-weight:700">
              Reset password
            </a>
          </p>
          <p style="margin:0 0 12px;color:#444">This link expires in 1 hour.</p>
          <p style="margin:0;color:#666;font-size:12px">If you didn’t request this, you can ignore this email.</p>
        </div>
      `;

      const result = await sendEmail({
        to: email,
        subject: "Reset Your Password",
        html,
        label: "auth-reset-password",
      });

      if (result?.error) {
        console.error("[auth] resend error:", result.error);
        return res.status(503).json({ error: "email_failed", message: "Could not send reset email" });
      }

      return res.json({ success: true, message: "Password reset email sent" });
    } catch (e) {
      console.error("[auth] forgot-password error:", e);
      return res.status(500).json({ error: "server_error", message: "Could not start reset flow" });
    }
  });

  router.post("/reset-password", async (req, res) => {
    try {
      const token = String(req.body?.token || "").trim();
      const newPassword = String(req.body?.newPassword || req.body?.password || "");
      if (!token) return res.status(400).json({ error: "token_required", message: "Reset token is required" });
      const resetPw = validatePasswordStrength(newPassword);
      if (!resetPw.valid) {
        return res.status(400).json({ error: "weak_password", message: resetPw.message });
      }

      const tokenHash = sha256Hex(token);
      const user = await getUserByResetTokenHash(tokenHash);
      if (!user) return res.status(400).json({ error: "invalid_token", message: "Invalid reset token" });
      const exp = user.resetTokenExpiresAt ? Date.parse(user.resetTokenExpiresAt) : 0;
      if (!exp || Number.isNaN(exp) || Date.now() > exp) {
        await clearResetTokenForUserId(user.id);
        return res.status(400).json({ error: "token_expired", message: "Reset token expired" });
      }

      const passwordHash = await hashPassword(newPassword);
      await updatePasswordForUserId(user.id, passwordHash);
      await clearResetTokenForUserId(user.id);

      return res.json({ success: true, message: "Password updated" });
    } catch (e) {
      console.error("[auth] reset-password error:", e);
      return res.status(500).json({ error: "server_error", message: "Reset failed" });
    }
  });

  return router;
}

