import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

/**
 * Top-level /barbers used by the Vite client (IFCDC barbers app).
 * In-memory `global.barbers` — swap for DB later.
 * Cold start: seed sample barbers until POST /barbers or other code replaces the store.
 */
const SAMPLE_BARBERS = [
  {
    id: 1,
    name: "Fade Master",
    specialty: "Fades",
    image: "/uploads/sample1.jpg",
    photo: "/uploads/sample1.jpg",
    styles: [],
    location: { address: "", latitude: null, longitude: null },
    paymentMode: "platform",
    splitPercent: 80,
    active: true,
  },
  {
    id: 2,
    name: "Clipper King",
    specialty: "Beards & Cuts",
    image: "/uploads/sample2.jpg",
    photo: "/uploads/sample2.jpg",
    styles: [],
    location: { address: "", latitude: null, longitude: null },
    paymentMode: "platform",
    splitPercent: 80,
    active: true,
  },
];

export function mountMinimalIfcdcApi(app, options = {}) {
  const uploadDir = options.uploadDir || path.join(process.cwd(), "uploads");
  const serveUploads = options.serveUploads !== false;
  const manage = typeof options.manageMiddleware === "function" ? options.manageMiddleware : (_req, _res, next) => next();

  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, uploadDir);
    },
    filename: (_req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  });
  const upload = multer({ storage });

  if (serveUploads) {
    app.use("/uploads", express.static(uploadDir));
  }

  function ensureBarbersStore() {
    if (!global.barbers) {
      global.barbers = SAMPLE_BARBERS.map((b) => ({
        ...b,
        styles: Array.isArray(b.styles) ? [...b.styles] : [],
      }));
    }
    for (const b of global.barbers) {
      if (!Array.isArray(b.styles)) b.styles = [];
      if (b.image && !b.photo) b.photo = b.image;
      if (b.photo && !b.image) b.image = b.photo;
      if (!b.location || typeof b.location !== "object") {
        b.location = { address: "", latitude: null, longitude: null };
      } else {
        if (b.location.address == null) b.location.address = "";
        if (b.location.latitude === undefined) b.location.latitude = null;
        if (b.location.longitude === undefined) b.location.longitude = null;
      }
      if (!["platform", "direct", "hybrid"].includes(b.paymentMode)) {
        b.paymentMode = "platform";
      }
      const sp = Number(b.splitPercent);
      b.splitPercent = Number.isFinite(sp) && sp >= 0 && sp <= 100 ? sp : 80;
      if (b.active === undefined) b.active = true;
    }
  }

  app.get("/barbers", (_req, res) => {
    ensureBarbersStore();
    res.json(global.barbers);
  });

  app.post(
    "/barbers",
    manage,
    upload.fields([
      { name: "photo", maxCount: 1 },
      { name: "image", maxCount: 1 },
    ]),
    (req, res) => {
      ensureBarbersStore();
      const file = req.files?.photo?.[0] || req.files?.image?.[0];
      const photo = file ? `/uploads/${file.filename}` : "";
      const name = String(req.body?.name ?? "").trim();
      if (!name) {
        return res.status(400).json({ error: "name is required" });
      }
      const newBarber = {
        id: Date.now(),
        name,
        photo,
        image: photo,
        styles: [],
        location: { address: "", latitude: null, longitude: null },
        paymentMode: "platform",
        splitPercent: 80,
        active: true,
      };
      global.barbers.push(newBarber);
      res.json(newBarber);
    }
  );

  app.post("/barbers/:id/styles", manage, upload.array("styles", 10), (req, res) => {
    ensureBarbersStore();
    const id = Number(req.params.id);
    const barber = global.barbers.find((b) => Number(b.id) === id);
    if (!barber) {
      return res.status(404).json({ error: "Not found" });
    }
    const files = req.files || [];
    if (!files.length) {
      return res.status(400).json({ error: "Add at least one image (field name: styles)" });
    }
    const newStyles = files.map((f) => `/uploads/${f.filename}`);
    barber.styles.push(...newStyles);
    res.json(barber);
  });

  /** PATCH barber settings: { paymentMode?, splitPercent?, active?, location? } */
  app.patch("/barbers/:id", manage, express.json(), (req, res) => {
    ensureBarbersStore();
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    const barber = global.barbers.find((b) => Number(b.id) === id);
    if (!barber) {
      return res.status(404).json({ error: "Not found" });
    }
    const { paymentMode, splitPercent, active, location } = req.body || {};
    if (paymentMode !== undefined) {
      if (!["platform", "direct", "hybrid"].includes(paymentMode)) {
        return res.status(400).json({ error: "paymentMode must be platform, direct, or hybrid" });
      }
      barber.paymentMode = paymentMode;
    }
    if (splitPercent !== undefined) {
      const sp = Number(splitPercent);
      if (!Number.isFinite(sp) || sp < 0 || sp > 100) {
        return res.status(400).json({ error: "splitPercent must be 0–100" });
      }
      barber.splitPercent = sp;
    }
    if (active !== undefined) {
      barber.active = Boolean(active);
    }
    if (location !== undefined) {
      if (!location || typeof location !== "object") {
        return res.status(400).json({ error: "location must be an object" });
      }
      const address = location.address != null ? String(location.address).trim() : "";
      const lat = location.latitude != null && location.latitude !== "" ? Number(location.latitude) : null;
      const lng = location.longitude != null && location.longitude !== "" ? Number(location.longitude) : null;
      if (lat !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        return res.status(400).json({ error: "location.latitude must be between -90 and 90" });
      }
      if (lng !== null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        return res.status(400).json({ error: "location.longitude must be between -180 and 180" });
      }
      barber.location = { address, latitude: lat, longitude: lng };
    }
    res.json(barber);
  });

  app.delete("/barbers/:id", manage, (req, res) => {
    ensureBarbersStore();
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }
    global.barbers = global.barbers.filter((b) => b.id !== id);
    res.json({ success: true, deleted: true });
  });

  /* POST/GET /bookings: bookingRoutesMinimal.cjs mounted in server.js (and src/server.js). */
  ensureBarbersStore();
}
