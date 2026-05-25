import { dbQuery } from "./db.js";

let columnsReady = false;
let auditReady = false;

/**
 * Idempotent — adds the four legal-acceptance columns to app_users so we
 * can lookup current acceptance state in O(1) without joining the audit
 * log.
 *
 *  - accepted_terms_at                (TIMESTAMPTZ)
 *  - accepted_privacy_at              (TIMESTAMPTZ)
 *  - accepted_notification_consent_at (TIMESTAMPTZ; NULL means declined / not yet given)
 *  - signup_app_version               (TEXT; mobile build number / version at acceptance time)
 */
export async function ensureLegalAcceptanceColumns() {
  if (columnsReady) return;
  try {
    await dbQuery(
      `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;`,
    );
    await dbQuery(
      `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS accepted_privacy_at TIMESTAMPTZ;`,
    );
    await dbQuery(
      `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS accepted_notification_consent_at TIMESTAMPTZ;`,
    );
    await dbQuery(
      `ALTER TABLE app_users ADD COLUMN IF NOT EXISTS signup_app_version TEXT;`,
    );
    columnsReady = true;
  } catch (e) {
    console.warn(
      "[migrate] ensureLegalAcceptanceColumns:",
      e?.message || e,
    );
  }
}

/**
 * Append-only audit table that records every acceptance event with version
 * and request metadata. Used for compliance evidence (App Store review,
 * GDPR / CCPA records, dispute investigations).
 *
 * `doc_key` matches the LegalDocKey enum in mobile/constants/legalContent.ts.
 * `doc_version` mirrors `POLICY_VERSION` from the same module so we know
 * which revision of the policies the user accepted.
 */
export async function ensureLegalAcceptancesTable() {
  if (auditReady) return;
  try {
    await dbQuery(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS legal_acceptances (
        id BIGSERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        doc_key TEXT NOT NULL,
        doc_version TEXT NOT NULL,
        accepted BOOLEAN NOT NULL DEFAULT TRUE,
        app_version TEXT,
        platform TEXT,
        ip_address TEXT,
        user_agent TEXT,
        accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        context TEXT
      );
    `);
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS legal_acceptances_user_idx
         ON legal_acceptances (user_id, doc_key, accepted_at DESC);`,
    );
    await dbQuery(
      `CREATE INDEX IF NOT EXISTS legal_acceptances_version_idx
         ON legal_acceptances (doc_key, doc_version);`,
    );
    auditReady = true;
  } catch (e) {
    console.warn(
      "[migrate] ensureLegalAcceptancesTable:",
      e?.message || e,
    );
  }
}

export async function ensureLegalAcceptanceSchema() {
  await ensureLegalAcceptanceColumns();
  await ensureLegalAcceptancesTable();
}
