import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_PATH = path.join(DATA_DIR, "users.json");

async function ensureUsersFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_PATH);
  } catch {
    await fs.writeFile(USERS_PATH, JSON.stringify({ users: [] }, null, 2), "utf8");
  }
}

async function readUsersFile() {
  await ensureUsersFile();
  const raw = await fs.readFile(USERS_PATH, "utf8");
  const data = raw ? JSON.parse(raw) : { users: [] };
  const users = Array.isArray(data?.users) ? data.users : [];
  return { users };
}

async function writeUsersFile(users) {
  await ensureUsersFile();
  const payload = { users };
  await fs.writeFile(USERS_PATH, JSON.stringify(payload, null, 2), "utf8");
}

export async function listUsers() {
  const { users } = await readUsersFile();
  return users;
}

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function safeUserPublic(u) {
  if (!u) return null;
  return {
    id: u.id,
    name: u.full_name ?? u.name,
    email: u.email,
    role: u.role,
    barberId: u.barber_id ?? u.barberId ?? null,
  };
}

export async function getUserByEmail(email) {
  const em = normalizeEmail(email);
  const { users } = await readUsersFile();
  return users.find((u) => u.email === em) || null;
}

export async function getUserById(id) {
  const { users } = await readUsersFile();
  return users.find((u) => String(u.id) === String(id)) || null;
}

export async function getUserByResetTokenHash(tokenHash) {
  const { users } = await readUsersFile();
  return users.find((u) => u.resetTokenHash && u.resetTokenHash === tokenHash) || null;
}

export async function createUser({ name, email, passwordHash, role }) {
  const em = normalizeEmail(email);
  const { users } = await readUsersFile();
  if (users.some((u) => u.email === em)) {
    const err = new Error("Email already exists");
    err.code = "email_exists";
    throw err;
  }
  const user = {
    id: crypto.randomUUID(),
    name: String(name || "").trim(),
    email: em,
    passwordHash,
    role: role || "user",
    createdAt: new Date().toISOString(),
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  };
  users.push(user);
  await writeUsersFile(users);
  return user;
}

export async function setResetTokenForEmail(email, { tokenHash, expiresAtIso }) {
  const em = normalizeEmail(email);
  const { users } = await readUsersFile();
  const idx = users.findIndex((u) => u.email === em);
  if (idx === -1) return null;
  users[idx] = {
    ...users[idx],
    resetTokenHash: tokenHash,
    resetTokenExpiresAt: expiresAtIso,
  };
  await writeUsersFile(users);
  return users[idx];
}

export async function clearResetTokenForUserId(userId) {
  const { users } = await readUsersFile();
  const idx = users.findIndex((u) => String(u.id) === String(userId));
  if (idx === -1) return null;
  users[idx] = { ...users[idx], resetTokenHash: null, resetTokenExpiresAt: null };
  await writeUsersFile(users);
  return users[idx];
}

export async function updatePasswordForUserId(userId, passwordHash) {
  const { users } = await readUsersFile();
  const idx = users.findIndex((u) => String(u.id) === String(userId));
  if (idx === -1) return null;
  users[idx] = { ...users[idx], passwordHash };
  await writeUsersFile(users);
  return users[idx];
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || ""), "utf8").digest("hex");
}

