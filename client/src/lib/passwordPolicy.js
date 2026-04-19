/**
 * Mirrors server `authPasswordPolicy.js` for client-side validation before submit.
 * Keep rules aligned when changing policy.
 */

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

/** @returns {{ valid: true } | { valid: false, message: string }} */
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
