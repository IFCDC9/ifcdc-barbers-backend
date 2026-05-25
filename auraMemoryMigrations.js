import { dbQuery } from "./db.js";

/** Chat transcript + lightweight preferences for AURA personalization. */
export async function ensureAuraMemoryTables() {
  await dbQuery(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS aura_user_preferences (
      user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
      notes TEXT,
      favorite_service TEXT,
      prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await dbQuery(`
    CREATE TABLE IF NOT EXISTS aura_chat_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await dbQuery(`CREATE INDEX IF NOT EXISTS aura_chat_messages_user_created_idx ON aura_chat_messages (user_id, created_at DESC);`);
}
