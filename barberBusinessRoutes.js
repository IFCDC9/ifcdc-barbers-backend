import express from "express";
import multer from "multer";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { dbQuery } from "./db.js";
import { requireAuth } from "./authRoutes.js";
import {
  resolveScopedBarberId,
  buildPublicBarberPricingResponse,
  loadBarberSettingsRow,
} from "./barberScope.js";
import {
  normalizeBillingProvider,
  normalizeTier,
  TIER_FREE,
  validateSubscriptionMonthlyPrice,
} from "./subscriptionTier.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

async function middlewareBarberScope(req, res, next) {
  try {
    const q = req.query?.barberId ?? req.body?.barberId ?? req.body?.barber_id;
    const resolved = await resolveScopedBarberId(req.user, q);
    if (resolved.error) {
      return res.status(resolved.status).json({ error: resolved.error, message: resolved.message });
    }
    req.barberId = resolved.barberId;
    return next();
  } catch (e) {
    console.error("[barber-business] scope:", e);
    return res.status(500).json({ error: "scope_failed", message: e?.message || String(e) });
  }
}

export function createBarberBusinessRouter({ uploadDir } = {}) {
  const router = express.Router();

  /** Public: live deposit rules + catalog services (no auth). */
  router.get("/api/barber/public/:id/pricing", async (req, res) => {
    const bid = num(req.params.id, NaN);
    if (!Number.isFinite(bid)) {
      return res.status(400).json({ error: "invalid_barber_id", message: "Invalid barber id" });
    }
    try {
      const exists = await dbQuery(`SELECT id FROM barbers WHERE id = $1 LIMIT 1`, [bid]);
      if (!exists.rows?.length) {
        return res.status(404).json({ error: "not_found", message: "Barber not found" });
      }
      const payload = await buildPublicBarberPricingResponse(bid);
      return res.json(payload);
    } catch (e) {
      console.error("[barber-business] public pricing:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to load pricing" });
    }
  });

  /** Public: authoritative charge breakdown (service + platform fee + tip) for PayPal + UI. */
  router.post("/api/barber/public/:id/booking-quote", async (req, res) => {
    const bid = num(req.params.id, NaN);
    if (!Number.isFinite(bid)) {
      return res.status(400).json({ error: "invalid_barber_id", message: "Invalid barber id" });
    }
    try {
      const exists = await dbQuery(`SELECT id FROM barbers WHERE id = $1 LIMIT 1`, [bid]);
      if (!exists.rows?.length) {
        return res.status(404).json({ error: "not_found", message: "Barber not found" });
      }
      const { computeStyleBookingBreakdown } = await import("./bookingBreakdown.js");
      const body = req.body && typeof req.body === "object" ? req.body : {};
      const styleId = String(body.styleId || body.style_id || "").trim();
      const paymentType = body.paymentType || body.payment_type || "full";
      const out = await computeStyleBookingBreakdown({ styleId, barberId: bid, paymentType, body });
      if (!out.ok) {
        return res.status(out.status || 400).json({ error: out.error, message: out.message });
      }
      return res.json({
        ok: true,
        subscription_tier: out.subscription_tier,
        breakdown: out.breakdown,
        styleId: out.styleId,
        styleTitle: out.styleTitle,
      });
    } catch (e) {
      console.error("[barber-business] booking-quote:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to compute quote" });
    }
  });

  const baseDir = uploadDir || path.join(__dirname, "backend", "uploads");
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, baseDir),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").slice(0, 12) || ".jpg";
      cb(null, `portfolio-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
    },
  });
  const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

  const BRANDING_MAX_BYTES = 5 * 1024 * 1024;
  const brandingImageMime = /^image\/(jpeg|pjpeg|png|gif|webp|avif)$/i;
  function brandingFileFilter(_req, file, cb) {
    if (!file.mimetype || !brandingImageMime.test(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, GIF, WebP, or AVIF images are allowed"));
    }
    cb(null, true);
  }

  const uploadBranding = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, baseDir),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").slice(0, 12).toLowerCase();
        const safe =
          ext === ".jpg" || ext === ".jpeg" || ext === ".png" || ext === ".gif" || ext === ".webp" || ext === ".avif"
            ? ext
            : ".jpg";
        cb(null, `branding-${Date.now()}-${Math.random().toString(16).slice(2)}${safe}`);
      },
    }),
    limits: { fileSize: BRANDING_MAX_BYTES },
    fileFilter: brandingFileFilter,
  });

  function handleBrandingUpload(req, res, next) {
    uploadBranding.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          error: "file_too_large",
          message: "Image must be 5MB or smaller",
        });
      }
      return res.status(400).json({
        error: "invalid_file",
        message: err.message || "Upload failed",
      });
    });
  }

  const chain = [requireAuth, middlewareBarberScope];

  /** POST /api/upload — barber-scoped; multipart field `file`; saves under /uploads, returns `{ url }`. */
  router.post("/api/upload", ...chain, handleBrandingUpload, (req, res) => {
    try {
      if (!req.file?.filename) {
        return res.status(400).json({ error: "file_required", message: "Multipart field `file` (image) is required" });
      }
      const url = `/uploads/${req.file.filename}`;
      return res.status(201).json({ url });
    } catch (e) {
      console.error("[barber-business] POST /api/upload:", e);
      return res.status(500).json({ error: "server_error", message: e?.message || String(e) });
    }
  });

  const registerProfile = (method, pathSuffix, ...handlers) => {
    router[method](pathSuffix, ...handlers);
  };

  // —— Profile ——
  registerProfile("get", "/api/barber/profile", ...chain, async (req, res) => {
    try {
      const bid = req.barberId;
      const r = await dbQuery(
        `SELECT b.id, b.user_id, b.name, b.bio, b.profile_image, b.logo, b.location, b.phone, b.created_at
         FROM barbers b WHERE b.id = $1 LIMIT 1`,
        [bid],
      );
      const row = r.rows?.[0];
      if (!row) return res.status(404).json({ error: "not_found", message: "Barber profile missing" });
      return res.json({ profile: row });
    } catch (e) {
      console.error("[barber-business] GET profile:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to load profile" });
    }
  });

  registerProfile("put", "/api/barber/profile", ...chain, async (req, res) => {
    try {
      const bid = req.barberId;
      const name = String(req.body?.name ?? "").trim();
      const bio = String(req.body?.bio ?? "").trim();
      const profile_image = String(req.body?.profile_image ?? req.body?.profileImage ?? "").trim() || null;
      const logo = String(req.body?.logo ?? "").trim() || null;
      const location = String(req.body?.location ?? "").trim() || null;
      const phone = String(req.body?.phone ?? "").trim() || null;

      if (name.length > 200) return res.status(400).json({ error: "validation", message: "Name too long" });
      if (bio.length > 4000) return res.status(400).json({ error: "validation", message: "Bio too long" });

      const r = await dbQuery(
        `UPDATE barbers SET
           name = COALESCE(NULLIF($2::text, ''), name),
           bio = $3,
           profile_image = $4,
           logo = $5,
           location = $6,
           phone = $7
         WHERE id = $1
         RETURNING id, user_id, name, bio, profile_image, logo, location, phone, created_at`,
        [bid, name || null, bio || null, profile_image, logo, location, phone],
      );
      return res.json({ profile: r.rows?.[0] });
    } catch (e) {
      console.error("[barber-business] PUT profile:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to save profile" });
    }
  });

  const servicesHandlers = [
    ...chain,
    async (req, res) => {
      try {
        const r = await dbQuery(
          `SELECT id, barber_id, name, price::float8 AS price, duration_minutes, is_active, created_at
           FROM barber_services WHERE barber_id = $1 ORDER BY id ASC`,
          [req.barberId],
        );
        return res.json({ services: r.rows || [] });
      } catch (e) {
        console.error("[barber-business] GET services:", e);
        return res.status(500).json({ error: "server_error", message: "Failed to load services" });
      }
    },
  ];

  router.get("/api/barber/services", ...servicesHandlers);
  router.get("/api/services", ...servicesHandlers);

  const postServiceHandler = async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      if (!name || name.length > 200) {
        return res.status(400).json({ error: "validation", message: "Service name is required" });
      }
      const price = money(req.body?.price ?? 0);
      const duration = Math.min(480, Math.max(5, num(req.body?.duration ?? req.body?.duration_minutes, 30)));
      const is_active = req.body?.is_active !== false && req.body?.isActive !== false;

      const ins = await dbQuery(
        `INSERT INTO barber_services (barber_id, name, price, duration_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, barber_id, name, price::float8 AS price, duration_minutes, is_active, created_at`,
        [req.barberId, name, price, duration, Boolean(is_active)],
      );
      return res.status(201).json({ service: ins.rows?.[0] });
    } catch (e) {
      console.error("[barber-business] POST services:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to create service" });
    }
  };
  router.post("/api/barber/services", ...chain, postServiceHandler);
  router.post("/api/services", ...chain, postServiceHandler);

  const putService = async (req, res) => {
    try {
      const id = num(req.params.id, NaN);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "validation", message: "Invalid id" });
      const name = String(req.body?.name ?? "").trim();
      const price = req.body?.price != null ? money(req.body.price) : null;
      const durationRaw = req.body?.duration ?? req.body?.duration_minutes;
      const duration = durationRaw != null ? Math.min(480, Math.max(5, num(durationRaw, 30))) : null;
      const is_active = req.body?.is_active ?? req.body?.isActive;

      const cur = await dbQuery(
        `SELECT id FROM barber_services WHERE id = $1 AND barber_id = $2 LIMIT 1`,
        [id, req.barberId],
      );
      if (!cur.rows?.length) return res.status(404).json({ error: "not_found", message: "Service not found" });

      const r = await dbQuery(
        `UPDATE barber_services SET
           name = COALESCE(NULLIF($3::text, ''), name),
           price = COALESCE($4::numeric, price),
           duration_minutes = COALESCE($5::int, duration_minutes),
           is_active = CASE WHEN $6::boolean IS NULL THEN is_active ELSE $6::boolean END
         WHERE id = $1 AND barber_id = $2
         RETURNING id, barber_id, name, price::float8 AS price, duration_minutes, is_active, created_at`,
        [id, req.barberId, name || null, price, duration, is_active == null ? null : Boolean(is_active)],
      );
      return res.json({ service: r.rows?.[0] });
    } catch (e) {
      console.error("[barber-business] PUT service:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to update service" });
    }
  };
  router.put("/api/barber/services/:id", ...chain, putService);
  router.put("/api/services/:id", ...chain, putService);

  const delService = async (req, res) => {
    try {
      const id = num(req.params.id, NaN);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "validation", message: "Invalid id" });
      const r = await dbQuery(`DELETE FROM barber_services WHERE id = $1 AND barber_id = $2 RETURNING id`, [
        id,
        req.barberId,
      ]);
      if (!r.rows?.length) return res.status(404).json({ error: "not_found", message: "Service not found" });
      return res.json({ ok: true, id: r.rows[0].id });
    } catch (e) {
      console.error("[barber-business] DELETE service:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to delete service" });
    }
  };
  router.delete("/api/barber/services/:id", ...chain, delService);
  router.delete("/api/services/:id", ...chain, delService);

  // —— Availability ——
  const getAvailabilityHandler = async (req, res) => {
    try {
      const r = await dbQuery(
        `SELECT id, barber_id, day_of_week, to_char(start_time, 'HH24:MI') AS start_time,
                to_char(end_time, 'HH24:MI') AS end_time, is_off
         FROM barber_availability WHERE barber_id = $1 ORDER BY day_of_week, start_time`,
        [req.barberId],
      );
      return res.json({ availability: r.rows || [] });
    } catch (e) {
      console.error("[barber-business] GET availability:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to load availability" });
    }
  };
  router.get("/api/barber/availability", ...chain, getAvailabilityHandler);
  router.get("/api/availability", ...chain, getAvailabilityHandler);

  const putAvailabilityHandler = async (req, res) => {
    try {
      const bid = req.barberId;
      const slots = Array.isArray(req.body?.availability) ? req.body.availability : req.body?.slots;
      if (!Array.isArray(slots)) {
        return res.status(400).json({ error: "validation", message: "Body must include availability: []" });
      }

      await dbQuery(`DELETE FROM barber_availability WHERE barber_id = $1`, [bid]);

      for (const row of slots) {
        const dow = num(row.day_of_week ?? row.dayOfWeek, NaN);
        const start = String(row.start_time ?? row.startTime ?? "").trim();
        const end = String(row.end_time ?? row.endTime ?? "").trim();
        const is_off = Boolean(row.is_off ?? row.isOff);
        if (!Number.isFinite(dow) || dow < 0 || dow > 6) {
          return res.status(400).json({ error: "validation", message: "day_of_week must be 0–6" });
        }
        if (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end)) {
          return res.status(400).json({ error: "validation", message: "start_time and end_time must be HH:MM" });
        }
        await dbQuery(
          `INSERT INTO barber_availability (barber_id, day_of_week, start_time, end_time, is_off)
           VALUES ($1, $2, $3::time, $4::time, $5)`,
          [bid, dow, start, end, is_off],
        );
      }

      const r = await dbQuery(
        `SELECT id, barber_id, day_of_week, to_char(start_time, 'HH24:MI') AS start_time,
                to_char(end_time, 'HH24:MI') AS end_time, is_off
         FROM barber_availability WHERE barber_id = $1 ORDER BY day_of_week, start_time`,
        [bid],
      );
      return res.json({ availability: r.rows || [] });
    } catch (e) {
      console.error("[barber-business] PUT availability:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to save availability" });
    }
  };
  router.put("/api/barber/availability", ...chain, putAvailabilityHandler);
  router.put("/api/availability", ...chain, putAvailabilityHandler);

  // —— Settings ——
  const getSettingsHandler = async (req, res) => {
    try {
      await dbQuery(
        `INSERT INTO barber_settings (barber_id) VALUES ($1) ON CONFLICT (barber_id) DO NOTHING`,
        [req.barberId],
      );
      const st = await loadBarberSettingsRow(req.barberId);
      return res.json({ settings: { barber_id: req.barberId, ...st } });
    } catch (e) {
      console.error("[barber-business] GET settings:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to load settings" });
    }
  };
  router.get("/api/barber/settings", ...chain, getSettingsHandler);
  router.get("/api/settings", ...chain, getSettingsHandler);

  const putSettingsHandler = async (req, res) => {
    try {
      const bid = req.barberId;
      await dbQuery(
        `INSERT INTO barber_settings (barber_id) VALUES ($1) ON CONFLICT (barber_id) DO NOTHING`,
        [bid],
      );

      const existing = await loadBarberSettingsRow(bid);

      const theme_color = String(req.body?.theme_color ?? req.body?.themeColor ?? "").trim();
      const booking_deposit_enabled = req.body?.booking_deposit_enabled ?? req.body?.bookingDepositEnabled;
      const deposit_amount = req.body?.deposit_amount ?? req.body?.depositAmount;
      const payment_method = String(req.body?.payment_method ?? req.body?.paymentMethod ?? "").trim();
      const aura_enabled = req.body?.aura_enabled ?? req.body?.auraEnabled;
      const aura_voice_type = String(req.body?.aura_voice_type ?? req.body?.auraVoiceType ?? "").trim();
      const language = String(req.body?.language ?? "").trim();

      const tierRaw = req.body?.subscription_tier ?? req.body?.subscriptionTier;
      const tierUpdate =
        tierRaw != null && String(tierRaw).trim() !== "" ? normalizeTier(String(tierRaw)) : null;
      const nextTier = tierUpdate ?? existing.subscription_tier;

      const subPriceRaw = req.body?.subscription_monthly_price ?? req.body?.subscriptionMonthlyPrice;
      let priceSqlToken = "noop";
      if (subPriceRaw === "" || tierUpdate === TIER_FREE) priceSqlToken = "clear";
      else if (subPriceRaw != null && String(subPriceRaw).trim() !== "") priceSqlToken = String(money(subPriceRaw));

      let nextMonthlyPrice = existing.subscription_monthly_price;
      if (priceSqlToken === "clear") nextMonthlyPrice = null;
      else if (priceSqlToken !== "noop") nextMonthlyPrice = money(priceSqlToken);
      if (normalizeTier(nextTier) === TIER_FREE) nextMonthlyPrice = null;

      const v = validateSubscriptionMonthlyPrice(nextTier, nextMonthlyPrice);
      if (!v.ok) {
        return res.status(400).json({ error: "validation", message: v.message || "Invalid subscription price" });
      }

      const billingProvRaw = req.body?.billing_provider ?? req.body?.billingProvider;
      const billingSubIdRaw = req.body?.billing_subscription_id ?? req.body?.billingSubscriptionId;
      let billingSubSql = "noop";
      if (billingSubIdRaw === "") billingSubSql = "clear";
      else if (billingSubIdRaw != null) billingSubSql = String(billingSubIdRaw).trim() || "clear";

      const r = await dbQuery(
        `UPDATE barber_settings SET
           theme_color = CASE WHEN $2::text IS NULL OR $2::text = '' THEN theme_color ELSE $2::text END,
           booking_deposit_enabled = CASE WHEN $3::boolean IS NULL THEN booking_deposit_enabled ELSE $3::boolean END,
           deposit_amount = CASE WHEN $4::numeric IS NULL THEN deposit_amount ELSE $4::numeric END,
           payment_method = CASE WHEN $5::text IS NULL OR $5::text = '' THEN payment_method ELSE $5::text END,
           aura_enabled = CASE WHEN $6::boolean IS NULL THEN aura_enabled ELSE $6::boolean END,
           aura_voice_type = CASE WHEN $7::text IS NULL OR $7::text = '' THEN aura_voice_type ELSE $7::text END,
           language = CASE WHEN $8::text IS NULL OR $8::text = '' THEN language ELSE $8::text END,
           subscription_tier = CASE WHEN $9::text IS NULL OR $9::text = '' THEN subscription_tier ELSE $9::text END,
           subscription_monthly_price = CASE
             WHEN $10::text = 'noop' THEN subscription_monthly_price
             WHEN $10::text = 'clear' THEN NULL
             ELSE $10::numeric
           END,
           billing_provider = CASE WHEN $11::text IS NULL OR $11::text = '' THEN billing_provider ELSE $11::text END,
           billing_subscription_id = CASE
             WHEN $12::text = 'noop' THEN billing_subscription_id
             WHEN $12::text = 'clear' THEN NULL
             ELSE $12::text
           END
         WHERE barber_id = $1`,
        [
          bid,
          theme_color || null,
          booking_deposit_enabled == null ? null : Boolean(booking_deposit_enabled),
          deposit_amount != null ? money(deposit_amount) : null,
          payment_method || null,
          aura_enabled == null ? null : Boolean(aura_enabled),
          aura_voice_type || null,
          language || null,
          tierUpdate || null,
          priceSqlToken,
          billingProvRaw != null && String(billingProvRaw).trim() !== ""
            ? normalizeBillingProvider(billingProvRaw)
            : null,
          billingSubSql,
        ],
      );
      if (!r.rowCount) {
        return res.status(404).json({ error: "not_found", message: "Barber settings not found" });
      }
      const st = await loadBarberSettingsRow(bid);
      return res.json({ settings: { barber_id: bid, ...st } });
    } catch (e) {
      console.error("[barber-business] PUT settings:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to save settings" });
    }
  };
  router.put("/api/barber/settings", ...chain, putSettingsHandler);
  router.put("/api/settings", ...chain, putSettingsHandler);

  // —— Clients ——
  const getClientsHandler = async (req, res) => {
    try {
      const r = await dbQuery(
        `SELECT id, barber_id, name, email, phone, notes, created_at FROM barber_clients WHERE barber_id = $1 ORDER BY created_at DESC LIMIT 500`,
        [req.barberId],
      );
      return res.json({ clients: r.rows || [] });
    } catch (e) {
      console.error("[barber-business] GET clients:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to load clients" });
    }
  };
  router.get("/api/barber/clients", ...chain, getClientsHandler);
  router.get("/api/clients", ...chain, getClientsHandler);

  const postClientsHandler = async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      if (!name || name.length > 200) {
        return res.status(400).json({ error: "validation", message: "Client name is required" });
      }
      const email = String(req.body?.email ?? "").trim() || null;
      const phone = String(req.body?.phone ?? "").trim() || null;
      const notes = String(req.body?.notes ?? "").trim() || null;
      if (notes && notes.length > 4000) {
        return res.status(400).json({ error: "validation", message: "Notes too long" });
      }

      const ins = await dbQuery(
        `INSERT INTO barber_clients (barber_id, name, email, phone, notes) VALUES ($1, $2, $3, $4, $5)
         RETURNING id, barber_id, name, email, phone, notes, created_at`,
        [req.barberId, name, email, phone, notes],
      );
      return res.status(201).json({ client: ins.rows?.[0] });
    } catch (e) {
      console.error("[barber-business] POST clients:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to create client" });
    }
  };
  router.post("/api/barber/clients", ...chain, postClientsHandler);
  router.post("/api/clients", ...chain, postClientsHandler);

  // —— Portfolio media ——
  router.get("/api/barber/media", ...chain, async (req, res) => {
    try {
      const r = await dbQuery(
        `SELECT id, barber_id, image_url, caption, sort_order, created_at
         FROM barber_portfolio_images WHERE barber_id = $1 ORDER BY sort_order ASC, id ASC`,
        [req.barberId],
      );
      return res.json({ media: r.rows || [] });
    } catch (e) {
      console.error("[barber-business] GET media:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to load media" });
    }
  });

  router.post("/api/barber/media", ...chain, upload.single("image"), async (req, res) => {
    try {
      const caption = String(req.body?.caption ?? "").trim().slice(0, 500) || null;
      const sort_order = num(req.body?.sort_order ?? req.body?.sortOrder, 0);
      const url = req.file ? `/uploads/${req.file.filename}` : String(req.body?.image_url ?? req.body?.imageUrl ?? "").trim();
      if (!url) return res.status(400).json({ error: "validation", message: "Image file or image_url required" });

      const ins = await dbQuery(
        `INSERT INTO barber_portfolio_images (barber_id, image_url, caption, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, barber_id, image_url, caption, sort_order, created_at`,
        [req.barberId, url, caption, sort_order],
      );
      return res.status(201).json({ item: ins.rows?.[0] });
    } catch (e) {
      console.error("[barber-business] POST media:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to save media" });
    }
  });

  router.delete("/api/barber/media/:id", ...chain, async (req, res) => {
    try {
      const id = num(req.params.id, NaN);
      if (!Number.isFinite(id)) return res.status(400).json({ error: "validation", message: "Invalid id" });
      const r = await dbQuery(`DELETE FROM barber_portfolio_images WHERE id = $1 AND barber_id = $2 RETURNING id`, [
        id,
        req.barberId,
      ]);
      if (!r.rows?.length) return res.status(404).json({ error: "not_found", message: "Media not found" });
      return res.json({ ok: true, id: r.rows[0].id });
    } catch (e) {
      console.error("[barber-business] DELETE media:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to delete media" });
    }
  });

  /** Ledger rows: mandatory per-booking platform fee (barber accrual). */
  router.get("/api/barber/fees/:barberId", requireAuth, async (req, res) => {
    try {
      const resolved = await resolveScopedBarberId(req.user, req.params.barberId);
      if (resolved.error) {
        return res.status(resolved.status).json({ error: resolved.error, message: resolved.message });
      }
      const bid = resolved.barberId;
      const r = await dbQuery(
        `SELECT id, barber_id, booking_id, fee_amount::float8 AS fee_amount, fee_status, billed_at, paid_at, created_at
         FROM barber_fee_ledger
         WHERE barber_id = $1
         ORDER BY id DESC
         LIMIT 500`,
        [bid],
      );
      return res.json({ ok: true, fees: r.rows || [] });
    } catch (e) {
      console.error("[barber-business] GET fees:", e);
      return res.status(500).json({ error: "server_error", message: e?.message || String(e) });
    }
  });

  /** Aggregates for barber dashboard (fees are internal; not shown to end customers on public booking). */
  router.get("/api/barber/billing-summary/:barberId", requireAuth, async (req, res) => {
    try {
      const resolved = await resolveScopedBarberId(req.user, req.params.barberId);
      if (resolved.error) {
        return res.status(resolved.status).json({ error: resolved.error, message: resolved.message });
      }
      const bid = resolved.barberId;
      const [cnt, svc, acc, st] = await Promise.all([
        dbQuery(`SELECT COUNT(*)::int AS n FROM bookings WHERE barber_id = $1`, [bid]),
        dbQuery(`SELECT COALESCE(SUM(total_price), 0)::float8 AS s FROM bookings WHERE barber_id = $1`, [bid]),
        dbQuery(
          `SELECT COALESCE(SUM(fee_amount), 0)::float8 AS s FROM barber_fee_ledger WHERE barber_id = $1 AND fee_status IN ('accrued','pending')`,
          [bid],
        ),
        loadBarberSettingsRow(bid),
      ]);
      const totalBookings = Number(cnt.rows?.[0]?.n) || 0;
      const serviceTotalUsd = money(Number(svc.rows?.[0]?.s) || 0);
      const accruedPlatformFeesUsd = money(Number(acc.rows?.[0]?.s) || 0);
      const platformFeeUsd = 0.99;
      const netBarberEstimateUsd = money(Math.max(0, serviceTotalUsd - accruedPlatformFeesUsd));
      return res.json({
        ok: true,
        barberId: bid,
        totalBookings,
        serviceTotalUsd,
        platformFeeUsd,
        accruedPlatformFeesUsd,
        netBarberEarningsEstimateUsd: netBarberEstimateUsd,
        isPro: Boolean(st?.is_pro),
        proPurchaseStatus: String(st?.pro_purchase_status || "not_purchased"),
        proPurchasedAt: st?.pro_purchased_at || null,
        exampleForServiceUsd30: {
          serviceTotal: 30,
          platformFee: platformFeeUsd,
          netBarberEarnings: money(30 - platformFeeUsd),
        },
      });
    } catch (e) {
      console.error("[barber-business] GET billing-summary:", e);
      return res.status(500).json({ error: "server_error", message: e?.message || String(e) });
    }
  });

  // —— Admin: list barbers for scope picker ——
  router.get("/api/barber/list", requireAuth, async (req, res) => {
    const role = String(req.user?.role || "");
    if (role !== "super_admin" && role !== "admin") {
      return res.status(403).json({ error: "forbidden", message: "Admin only" });
    }
    try {
      const r = await dbQuery(`SELECT id, name, phone, user_id FROM barbers ORDER BY id ASC LIMIT 500`);
      return res.json({ barbers: r.rows || [] });
    } catch (e) {
      console.error("[barber-business] list:", e);
      return res.status(500).json({ error: "server_error", message: "Failed to list barbers" });
    }
  });

  return router;
}
