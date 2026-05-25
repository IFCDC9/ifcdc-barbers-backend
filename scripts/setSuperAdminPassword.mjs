/**
 * Bootstrap service@ifcdc.org as super_admin with bcrypt (same path as production auth).
 *
 * Usage (from repo root):
 *   node scripts/setSuperAdminPassword.mjs --generate
 *   SUPER_ADMIN_PASSWORD='YourStr0ng!Secret' node scripts/setSuperAdminPassword.mjs
 *
 * Optional env: SUPER_ADMIN_EMAIL, DATABASE_URL (via .env), API_BASE=http://127.0.0.1:10000
 */
import "../loadBackendEnv.mjs";
import crypto from "node:crypto";
import { dbQuery } from "../db.js";
import { hashPassword, validatePasswordStrength } from "../authPasswordPolicy.js";
import { normalizeEmail } from "../authStore.js";
import { CANONICAL_SUPER_ADMIN_EMAIL } from "../rolePolicy.js";
import { ensureUsersRoleColumn } from "../authDbMigrations.js";
import { jwtClaimsFromAppUser, publicUserFromAppUser } from "../authPlatformJwt.js";
import { resolveAuthPayload } from "../authRoutes.js";

const email = normalizeEmail(process.env.SUPER_ADMIN_EMAIL || CANONICAL_SUPER_ADMIN_EMAIL);
const generateFlag = process.argv.includes("--generate") || process.argv.includes("-g");
const testLoginFlag = !process.argv.includes("--no-test");

function generateSecurePassword() {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*-_+=.";
  const pick = (chars, n) =>
    Array.from(crypto.randomFillSync(new Uint8Array(n)), (b) => chars[b % chars.length]).join("");
  const chars = [pick(upper, 4), pick(lower, 6), pick(digits, 3), pick(symbols, 3)].join("").split("");
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  const pwd = chars.join("");
  const check = validatePasswordStrength(pwd);
  if (!check.valid) return generateSecurePassword();
  return pwd;
}

function resolvePlainPassword() {
  const fromEnv = String(
    process.env.SUPER_ADMIN_PASSWORD || process.env.IFCDC_OWNER_PASSWORD || "",
  ).trim();
  if (fromEnv) return { password: fromEnv, source: "env" };
  if (generateFlag || process.argv.length <= 2) {
    return { password: generateSecurePassword(), source: "generated" };
  }
  return { password: "", source: "missing" };
}

async function upsertSuperAdmin(passwordHash) {
  const updated = await dbQuery(
    `UPDATE app_users
     SET password_hash = $1,
         role = 'super_admin',
         name = COALESCE(NULLIF(TRIM(name::text), ''), 'IFCDC Platform Owner')
     WHERE lower(trim(email::text)) = lower(trim($2::text))
     RETURNING id, name, email, role, barber_id, business_id`,
    [passwordHash, email],
  );

  if (updated.rows?.length) {
    return { created: false, user: updated.rows[0] };
  }

  const inserted = await dbQuery(
    `INSERT INTO app_users (name, email, password_hash, role)
     VALUES ($1, $2, $3, 'super_admin')
     RETURNING id, name, email, role, barber_id, business_id`,
    ["IFCDC Platform Owner", email, passwordHash],
  );
  return { created: true, user: inserted.rows[0] };
}

async function testAuthFlow(plainPassword) {
  const base = String(process.env.API_BASE || "http://127.0.0.1:10000").replace(/\/$/, "");
  const loginUrl = `${base}/api/auth/login`;

  let loginRes;
  try {
    loginRes = await fetch(loginUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password: plainPassword }),
    });
  } catch (e) {
    return {
      ok: false,
      step: "login_fetch",
      message: e instanceof Error ? e.message : String(e),
      hint: `Start API: npm run dev — then retry. URL: ${loginUrl}`,
    };
  }

  const loginJson = await loginRes.json().catch(() => ({}));
  if (!loginRes.ok || !loginJson?.token) {
    return {
      ok: false,
      step: "login_response",
      status: loginRes.status,
      body: loginJson,
    };
  }

  const token = String(loginJson.token).trim();
  const payload = resolveAuthPayload(token);
  const meUrl = `${base}/api/auth/me`;
  const meRes = await fetch(meUrl, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  const meJson = await meRes.json().catch(() => ({}));

  const privilegesOk =
    loginJson.user?.isOwner === true
    && loginJson.user?.isSuperAdmin === true
    && (loginJson.user?.role === "admin" || loginJson.redirect === "admin_dashboard")
    && payload?.isSuperAdmin === true
    && payload?.isOwner === true;

  return {
    ok: loginRes.ok && Boolean(token) && privilegesOk,
    step: "complete",
    loginStatus: loginRes.status,
    loginUser: loginJson.user,
    redirect: loginJson.redirect,
    jwtClaims: payload,
    meStatus: meRes.status,
    meUser: meJson.user,
    privilegesOk,
  };
}

async function main() {
  const { password, source } = resolvePlainPassword();
  if (!password) {
    console.error(
      "Missing password. Use:\n" +
        "  node scripts/setSuperAdminPassword.mjs --generate\n" +
        "  SUPER_ADMIN_PASSWORD='…' node scripts/setSuperAdminPassword.mjs",
    );
    process.exit(1);
  }

  const check = validatePasswordStrength(password);
  if (!check.valid) {
    console.error("Password policy:", check.message);
    process.exit(1);
  }

  if (!process.env.DATABASE_URL?.trim()) {
    console.error("DATABASE_URL is not set. Add it to .env or backend/.env.");
    process.exit(1);
  }

  await ensureUsersRoleColumn();

  const hash = await hashPassword(password);
  const { created, user } = await upsertSuperAdmin(hash);

  const claims = jwtClaimsFromAppUser(user);
  const publicUser = publicUserFromAppUser(user);

  console.log("");
  console.log("════════════════════════════════════════════════════════════");
  console.log("  IFCDC SUPER ADMIN — BOOTSTRAP COMPLETE");
  console.log("════════════════════════════════════════════════════════════");
  console.log(`  Email:     ${user.email}`);
  console.log(`  DB role:   ${user.role} (JWT exposes role: ${publicUser.role})`);
  console.log(`  Account:   ${created ? "created" : "updated"}`);
  console.log(`  isOwner:   ${publicUser.isOwner}`);
  console.log(`  isSuperAdmin: ${publicUser.isSuperAdmin}`);
  if (source === "generated") {
    console.log("────────────────────────────────────────────────────────────");
    console.log("  TEMPORARY PASSWORD (store securely, then rotate):");
    console.log("");
    console.log(`  ${password}`);
    console.log("");
    console.log("  This password is shown once. It is not written to .env or git.");
  } else {
    console.log("  Password: set from environment (not printed).");
  }
  console.log("════════════════════════════════════════════════════════════");
  console.log("");

  if (testLoginFlag) {
    console.log("[test] POST /api/auth/login …");
    const test = await testAuthFlow(password);
    if (!test.ok) {
      console.error("[test] FAILED at", test.step, test);
      if (test.hint) console.error(test.hint);
      process.exit(1);
    }
    console.log("[test] login HTTP", test.loginStatus);
    console.log("[test] redirect:", test.redirect);
    console.log("[test] user:", JSON.stringify(test.loginUser, null, 2));
    console.log("[test] JWT claims:", JSON.stringify(test.jwtClaims, null, 2));
    console.log("[test] GET /api/auth/me HTTP", test.meStatus);
    console.log("[test] me user:", JSON.stringify(test.meUser, null, 2));
    console.log("[test] admin privileges:", test.privilegesOk ? "OK" : "MISMATCH");
  }
}

main().catch((e) => {
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});
