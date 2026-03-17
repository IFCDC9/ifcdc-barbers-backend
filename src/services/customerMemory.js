import db from "../db/db.js";

const CUSTOMER_MEMORY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS customer_memory (
    customer_id INTEGER PRIMARY KEY,
    customer_name VARCHAR(255),
    preferred_language VARCHAR(20),
    preferences JSONB DEFAULT '{}'::jsonb,
    last_service VARCHAR(255),
    last_barber VARCHAR(255),
    visit_count INTEGER DEFAULT 0,
    last_visit TIMESTAMP,
    favorite_barber VARCHAR(255),
    favorite_service VARCHAR(255),
    visit_frequency_days INTEGER,
    last_haircut_date DATE,
    barber_counts JSONB DEFAULT '{}'::jsonb,
    service_counts JSONB DEFAULT '{}'::jsonb
  );

  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS favorite_barber VARCHAR(255);
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS favorite_service VARCHAR(255);
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS visit_frequency_days INTEGER;
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS last_haircut_date DATE;
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS barber_counts JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS service_counts JSONB DEFAULT '{}'::jsonb;
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255);
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20);
  ALTER TABLE customer_memory ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::jsonb;
`;

let schemaEnsured = false;

const ensureCustomerMemorySchema = async () => {
  if (schemaEnsured) return;
  await db.query(CUSTOMER_MEMORY_SCHEMA_SQL);
  schemaEnsured = true;
};

const toCountsObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const toPreferencesObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const mergePreferences = (base = {}, patch = {}) => {
  const merged = { ...toPreferencesObject(base) };

  Object.entries(toPreferencesObject(patch)).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      merged[key] = value;
    }
  });

  return merged;
};

const incrementCount = (counts, key) => {
  if (!key) return counts;
  return {
    ...counts,
    [key]: Number(counts[key] || 0) + 1
  };
};

const getTopKey = (counts = {}) => {
  const entries = Object.entries(counts);
  if (!entries.length) return null;

  const [topKey] = entries.sort((left, right) => {
    const countDelta = Number(right[1] || 0) - Number(left[1] || 0);
    if (countDelta !== 0) return countDelta;
    return String(left[0]).localeCompare(String(right[0]));
  })[0];

  return topKey;
};

const getFrequencyDays = (previousVisit, nextVisit) => {
  if (!previousVisit || !nextVisit) return null;

  const previousDate = new Date(previousVisit);
  const nextDateValue = new Date(nextVisit);
  if (Number.isNaN(previousDate.getTime()) || Number.isNaN(nextDateValue.getTime())) {
    return null;
  }

  const diffMs = nextDateValue.getTime() - previousDate.getTime();
  if (diffMs <= 0) return null;

  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
};

const normalizeMemoryRow = (row) => {
  if (!row) return null;

  return {
    ...row,
    name: row.customer_name || null,
    language: row.preferred_language || null,
    preferences: toPreferencesObject(row.preferences),
    favorite_barber: row.favorite_barber || row.last_barber || null,
    favorite_service: row.favorite_service || row.last_service || null,
    visit_frequency_days: row.visit_frequency_days ?? null,
    last_haircut_date: row.last_haircut_date || row.last_visit || null
  };
};

export async function getCustomerMemory(customerId) {
  await ensureCustomerMemorySchema();

  const result = await db.query(
    `SELECT * FROM customer_memory
     WHERE customer_id = $1`,
    [customerId]
  );

  return normalizeMemoryRow(result.rows[0] || null);
}

export async function getCustomerByPhone(phone) {
  const normalized = String(phone || "").replace(/\D/g, "")
  if (!normalized) return null

  const result = await db.query(
    `SELECT * FROM customers WHERE regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g') = $1 OR RIGHT(regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g'), 10) = $2 LIMIT 1`,
    [normalized, normalized.slice(-10)]
  )

  return result.rows[0] || null
}

export async function updateCustomerByPhone(phone, barber, service) {
  const normalized = String(phone || "").replace(/\D/g, "")
  if (!normalized) return null

  await db.query(
    `UPDATE customers
     SET favorite_barber = $2,
         favorite_service = $3,
         visit_count = COALESCE(visit_count, 0) + 1,
         last_visit = NOW()
     WHERE regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g') = $1
        OR RIGHT(regexp_replace(COALESCE(phone::text, ''), '[^0-9]', '', 'g'), 10) = $1`,
    [normalized, barber, service]
  )

  return true
}

export async function updateCustomerMemory(customerId, service, barber, options = {}) {
  await ensureCustomerMemorySchema();

  const isDateLikeOptions = options instanceof Date || typeof options === "string" || typeof options === "number"
  const normalizedOptions = isDateLikeOptions ? { haircutDate: options } : (options || {})

  const existing = await getCustomerMemory(customerId);
  const barberCounts = incrementCount(toCountsObject(existing?.barber_counts), barber);
  const serviceCounts = incrementCount(toCountsObject(existing?.service_counts), service);
  const lastVisitSource = normalizedOptions.haircutDate || new Date()
  const lastVisit = lastVisitSource instanceof Date ? lastVisitSource : new Date(lastVisitSource);
  const visitFrequencyDays = getFrequencyDays(existing?.last_visit, lastVisit);
  const mergedPreferences = mergePreferences(
    existing?.preferences,
    normalizedOptions.preferences || {
      preferred_barber: barber || existing?.favorite_barber || existing?.last_barber || null,
      preferred_service: service || existing?.favorite_service || existing?.last_service || null
    }
  )
  const customerName = normalizedOptions.name || existing?.customer_name || null
  const preferredLanguage = normalizedOptions.language || existing?.preferred_language || null
  const effectiveLastService = service || existing?.last_service || null
  const effectiveLastBarber = barber || normalizedOptions.lastBarber || existing?.last_barber || null
  const effectiveFavoriteBarber = getTopKey(barberCounts) || effectiveLastBarber
  const effectiveFavoriteService = getTopKey(serviceCounts) || effectiveLastService

  const params = [
    customerId,
    customerName,
    preferredLanguage,
    JSON.stringify(mergedPreferences),
    effectiveLastService,
    effectiveLastBarber,
    lastVisit,
    effectiveFavoriteBarber,
    effectiveFavoriteService,
    visitFrequencyDays,
    lastVisit,
    JSON.stringify(barberCounts),
    JSON.stringify(serviceCounts),
    Number(existing?.visit_count || 0) + 1
  ];

  if (existing) {
    await db.query(
      `
      UPDATE customer_memory
      SET
        customer_name = $2,
        preferred_language = $3,
        preferences = $4,
        last_service = $5,
        last_barber = $6,
        last_visit = $7,
        favorite_barber = $8,
        favorite_service = $9,
        visit_frequency_days = $10,
        last_haircut_date = $11,
        barber_counts = $12,
        service_counts = $13,
        visit_count = $14
      WHERE customer_id = $1
    `,
      params
    );
    return;
  }

  await db.query(
    `
    INSERT INTO customer_memory
    (
      customer_id,
      customer_name,
      preferred_language,
      preferences,
      last_service,
      last_barber,
      last_visit,
      favorite_barber,
      favorite_service,
      visit_frequency_days,
      last_haircut_date,
      barber_counts,
      service_counts,
      visit_count
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
  `,
    params
  );
}

export async function upsertCustomerProfile(customerId, profile = {}) {
  if (!customerId) return null

  const options = {
    name: profile.name || null,
    language: profile.language || null,
    preferences: profile.preferences || {},
    lastBarber: profile.lastBarber || null,
    haircutDate: profile.haircutDate || new Date()
  }

  return updateCustomerMemory(
    customerId,
    profile.service || null,
    profile.lastBarber || profile.barber || null,
    options
  )
}
