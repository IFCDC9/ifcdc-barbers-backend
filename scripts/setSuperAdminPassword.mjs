/**
 * Set bcrypt hash for the super admin account (password never logged or stored in plain text).
 *
 * Usage (from repo root, password only in env — do not commit):
 *   SUPER_ADMIN_PASSWORD='YourStr0ng!Secret' node scripts/setSuperAdminPassword.mjs
 *
 * Optional: SUPER_ADMIN_EMAIL=service@ifcdc.org
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dbQuery } from "../db.js";
import { hashPassword, validatePasswordStrength } from "../authPasswordPolicy.js";
import { normalizeEmail } from "../authStore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, "backend", ".env") });

const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || "service@ifcdc.org");
const pwd = process.env.SUPER_ADMIN_PASSWORD;

async function main() {
  if (!pwd || !String(pwd).trim()) {
    console.error(
      "Missing SUPER_ADMIN_PASSWORD. Run (example):\n" +
        "  SUPER_ADMIN_PASSWORD='YourStr0ng!Secret' npm run set-super-admin-password"
    );
    process.exit(1);
  }
  const check = validatePasswordStrength(pwd);
  if (!check.valid) {
    console.error(check.message);
    process.exit(1);
  }

  const costRaw = parseInt(process.env.BCRYPT_ROUNDS, 10);
  const bcryptCost = Number.isFinite(costRaw) && costRaw >= 4 && costRaw <= 15 ? costRaw : undefined;
  const hash = await hashPassword(pwd, bcryptCost);

  const updated = await dbQuery(
    `UPDATE app_users
     SET password_hash = $1
     WHERE lower(trim(email)) = lower(trim($2::text))
     RETURNING id, email, role`,
    [hash, email]
  );

  if (updated.rows?.length) {
    const u = updated.rows[0];
    console.log("Super admin password updated successfully");
    console.log(`Account: ${u.email} (role=${u.role}). JWT login still returns this role.`);
    return;
  }

  const inserted = await dbQuery(
    `INSERT INTO app_users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'super_admin')
     RETURNING id, email, role`,
    ["IFCDC Super Admin", email, hash]
  );
  const u = inserted.rows?.[0];
  console.log("Super admin password updated successfully");
  console.log(`Created super_admin user ${u?.email} (role=${u?.role}).`);
}

main().catch((e) => {
  console.error(e?.message || e);
  process.exit(1);
});
