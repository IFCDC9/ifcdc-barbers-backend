/**
 * Strong password rules for app_users (register, reset, bootstrap, CLI tools).
 * Passwords are never stored except as bcrypt hashes.
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs");

/** OWASP-style cost; keep in sync with all bcrypt.hash call sites. */
export const BCRYPT_ROUNDS = 12;

/** Exact weak passwords (compare case-insensitively). */
const BLOCKED_EXACT = new Set([
  "admin123",
  "123456",
  "1234567",
  "12345678",
  "123456789",
  "1234567890",
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "letmein",
  "welcome",
  "welcome1",
  "monkey",
  "dragon",
  "master",
  "sunshine",
  "princess",
  "football",
  "iloveyou",
  "abc123",
  "admin",
  "root",
  "toor",
  "passw0rd",
  "p@ssw0rd",
  "hello123",
  "changeme",
  "default",
]);

/**
 * @returns {{ valid: true } | { valid: false, message: string }}
 */
export function validatePasswordStrength(password) {
  const p = String(password ?? "");
  if (p.length < 12) {
    return { valid: false, message: "Password must be at least 12 characters." };
  }
  if (p.length > 128) {
    return { valid: false, message: "Password is too long (max 128 characters)." };
  }
  if (!/[A-Z]/.test(p)) {
    return { valid: false, message: "Password must include an uppercase letter." };
  }
  if (!/[a-z]/.test(p)) {
    return { valid: false, message: "Password must include a lowercase letter." };
  }
  if (!/[0-9]/.test(p)) {
    return { valid: false, message: "Password must include a number." };
  }
  if (!/[^A-Za-z0-9]/.test(p)) {
    return { valid: false, message: "Password must include a symbol (e.g. !@#$%)." };
  }
  if (/^(.)\1{11,}$/.test(p)) {
    return { valid: false, message: "Password is too repetitive." };
  }
  const lower = p.toLowerCase();
  if (BLOCKED_EXACT.has(lower)) {
    return { valid: false, message: "This password is too common. Choose a stronger one." };
  }
  return { valid: true };
}

/**
 * @param {string} plainText
 * @param {number} [rounds] — bcrypt cost (4–15); default `BCRYPT_ROUNDS`. Override with env `BCRYPT_ROUNDS` in scripts if needed.
 */
export async function hashPassword(plainText, rounds = BCRYPT_ROUNDS) {
  const r = Number(rounds);
  const cost = Number.isFinite(r) && r >= 4 && r <= 15 ? Math.floor(r) : BCRYPT_ROUNDS;
  return bcrypt.hash(String(plainText), cost);
}

/** Compare a plaintext password to a stored bcrypt hash. */
export async function comparePassword(plainText, passwordHash) {
  if (plainText == null || passwordHash == null) return false;
  const h = String(passwordHash).trim();
  if (!h) return false;
  try {
    return await bcrypt.compare(String(plainText), h);
  } catch {
    return false;
  }
}
