import { dbQuery } from "./db.js";
import { hashPassword, validatePasswordStrength } from "./authPasswordPolicy.js";

const DEFAULT_SUPER_EMAIL = "service@ifcdc.org";

/**
 * Reads bootstrap password from env only (never hardcoded).
 * Uses SUPER_ADMIN_BOOTSTRAP_PASSWORD, or SUPER_ADMIN_PASSWORD as fallback for first deploy.
 */
function readBootstrapPassword() {
  return String(
    process.env.SUPER_ADMIN_BOOTSTRAP_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || ""
  ).trim();
}

export async function ensureInitialSuperAdmin() {
  const email = DEFAULT_SUPER_EMAIL;

  const existing = await dbQuery(
    "SELECT id, email, role FROM app_users WHERE role = 'super_admin' LIMIT 1"
  );
  if ((existing.rows || []).length > 0) {
    return { ok: true, seeded: false, reason: "super_admin_exists" };
  }

  const bootstrap = readBootstrapPassword();
  const pwCheck = validatePasswordStrength(bootstrap);
  if (!pwCheck.valid) {
    console.warn(
      "[seed] super_admin: no row yet — set SUPER_ADMIN_BOOTSTRAP_PASSWORD (strong, 12+ chars) in .env, " +
        "or run: npm run set-super-admin-password"
    );
    if (bootstrap) {
      console.warn("[seed] super_admin: password rejected:", pwCheck.message);
    }
    return { ok: true, seeded: false, reason: "bootstrap_password_invalid_or_missing", detail: pwCheck.message };
  }

  const passwordHash = await hashPassword(bootstrap);

  const foundEmail = await dbQuery(
    "SELECT id, email, role FROM app_users WHERE email = $1 LIMIT 1",
    [email]
  );

  if ((foundEmail.rows || []).length === 0) {
    await dbQuery(
      `INSERT INTO app_users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'super_admin')`,
      ["IFCDC Super Admin", email, passwordHash]
    );
    return { ok: true, seeded: true, email };
  }

  const id = foundEmail.rows[0].id;
  await dbQuery(
    `UPDATE app_users
     SET role = 'super_admin',
         password_hash = $1,
         name = COALESCE(NULLIF(TRIM(name), ''), $2)
     WHERE id = $3`,
    [passwordHash, "IFCDC Super Admin", id]
  );
  return { ok: true, seeded: true, email, updatedExistingEmail: true };
}
