import { dbQuery } from "./db.js";
import { hashPassword, validatePasswordStrength } from "./authPasswordPolicy.js";
import { normalizeEmail } from "./authStore.js";
import { CANONICAL_SUPER_ADMIN_EMAIL } from "./rolePolicy.js";

const OWNER_EMAIL = normalizeEmail(CANONICAL_SUPER_ADMIN_EMAIL);

/**
 * Bootstrap password for service@ifcdc.org only (env — never hardcoded).
 * IFCDC_OWNER_PASSWORD is preferred; legacy vars still supported.
 */
function readOwnerBootstrapPassword() {
  return String(
    process.env.IFCDC_OWNER_PASSWORD ||
      process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD ||
      process.env.SUPER_ADMIN_PASSWORD ||
      ""
  ).trim();
}

function maySkipStrengthForOwnerBootstrap(pw) {
  if (!pw) return false;
  const check = validatePasswordStrength(pw);
  if (check.valid) return true;
  return String(process.env.IFCDC_ALLOW_WEAK_OWNER_BOOTSTRAP || "").trim() === "1";
}

/**
 * Ensures service@ifcdc.org exists in app_users as super_admin with a bcrypt hash when env password is set.
 * Weak passwords (e.g. local dev) require IFCDC_ALLOW_WEAK_OWNER_BOOTSTRAP=1.
 */
export async function ensureInitialSuperAdmin() {
  const bootstrap = readOwnerBootstrapPassword();
  const found = await dbQuery(
    "SELECT id, email, role, password_hash FROM app_users WHERE lower(trim(email::text)) = $1 LIMIT 1",
    [OWNER_EMAIL]
  );
  const row = found.rows?.[0] || null;

  let passwordHashToSet = null;
  if (bootstrap) {
    const strong = validatePasswordStrength(bootstrap);
    if (!strong.valid && !maySkipStrengthForOwnerBootstrap(bootstrap)) {
      console.warn(
        "[seed] platform_owner: password rejected by policy:",
        strong.message,
        "Set IFCDC_ALLOW_WEAK_OWNER_BOOTSTRAP=1 for local dev only, or use a stronger IFCDC_OWNER_PASSWORD."
      );
      if (!row?.password_hash) {
        console.warn(
          "[seed] platform_owner: no owner row or empty password_hash — set IFCDC_OWNER_PASSWORD and redeploy."
        );
      }
    } else {
      passwordHashToSet = await hashPassword(bootstrap);
    }
  }

  if (!row) {
    if (!passwordHashToSet) {
      console.warn(
        "[seed] platform_owner: missing row for",
        OWNER_EMAIL,
        "— set IFCDC_OWNER_PASSWORD (hashed on boot) or insert the user manually."
      );
      return { ok: true, seeded: false, reason: "missing_password_or_policy" };
    }
    await dbQuery(
      `INSERT INTO app_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'super_admin')`,
      ["IFCDC Platform Owner", OWNER_EMAIL, passwordHashToSet]
    );
    console.log("[seed] platform_owner: created", OWNER_EMAIL);
    return { ok: true, seeded: true, email: OWNER_EMAIL, created: true };
  }

  const updates = [];
  const params = [];
  let pi = 1;
  if (passwordHashToSet) {
    updates.push(`password_hash = $${pi++}`);
    params.push(passwordHashToSet);
  }
  if (String(row.role || "").trim() !== "super_admin") {
    updates.push(`role = 'super_admin'`);
  }
  updates.push(`name = COALESCE(NULLIF(TRIM(name::text), ''), $${pi++})`);
  params.push("IFCDC Platform Owner");
  params.push(row.id);
  const idPlaceholder = pi;

  if (updates.length) {
    await dbQuery(
      `UPDATE app_users SET ${updates.join(", ")} WHERE id = $${idPlaceholder}::uuid`,
      params
    );
    console.log("[seed] platform_owner: updated", OWNER_EMAIL, { password: Boolean(passwordHashToSet) });
    return { ok: true, seeded: true, email: OWNER_EMAIL, updatedExisting: true };
  }

  return { ok: true, seeded: false, reason: "owner_ok" };
}
