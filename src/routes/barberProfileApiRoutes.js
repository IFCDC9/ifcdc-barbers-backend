import express from "express"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { uploadMemory } from "../middleware/uploadMemory.js"
import { uploadBarberStyleImage } from "../services/storageUpload.js"
import {
  listProfiles,
  getProfileById,
  getProfileByName,
  createProfile,
  updateProfileById,
  addGalleryUrl,
  removeGalleryUrl,
  deleteProfileById,
} from "../services/barberProfileStore.js"

const router = express.Router()

const jsonErr = (res, status, code, message) =>
  res.status(status).json({ ok: false, error: code, message })

/** GET /api/barbers — public list (id, name, bio) */
router.get("/", async (_req, res) => {
  try {
    const profiles = await listProfiles()
    const barbers = profiles.map((p) => ({ id: p.id, name: p.name, bio: p.bio || "" }))
    return res.json({ ok: true, barbers, profiles })
  } catch (e) {
    console.error("[barbers] list:", e)
    return jsonErr(res, 500, "list_failed", e instanceof Error ? e.message : String(e))
  }
})

/** POST /api/barbers — admin create (alias of /profiles) */
router.post("/", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim()
    if (!name) return jsonErr(res, 400, "name_required", "name is required")
    const profile = await createProfile({
      name,
      bio: req.body?.bio,
      contactEmail: req.body?.contactEmail,
      contactPhone: req.body?.contactPhone,
      email: req.body?.email,
      phone: req.body?.phone,
      profileImageUrl: req.body?.profileImageUrl,
      gallery: req.body?.gallery,
    })
    return res.status(201).json({ ok: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonErr(res, 409, "name_taken", "A profile with this name already exists")
    }
    return jsonErr(res, 500, "create_failed", msg)
  }
})

/** DELETE /api/barbers/:id — admin */
router.delete("/:id(\\d+)", requireAdmin, async (req, res) => {
  try {
    await deleteProfileById(req.params.id)
    return res.json({ ok: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "not_found") return jsonErr(res, 404, "not_found", "Profile not found")
    return jsonErr(res, 500, "delete_failed", msg)
  }
})

/** GET /api/barbers/profiles — public list */
router.get("/profiles", async (_req, res) => {
  try {
    const profiles = await listProfiles()
    return res.json({ ok: true, profiles })
  } catch (e) {
    console.error("[barbers/profiles] list:", e)
    return jsonErr(res, 500, "list_failed", e instanceof Error ? e.message : String(e))
  }
})

/** GET /api/barbers/profiles/:id */
router.get("/profiles/:id", async (req, res) => {
  try {
    const p = await getProfileById(req.params.id)
    if (!p) return jsonErr(res, 404, "not_found", "Profile not found")
    return res.json({ ok: true, profile: p })
  } catch (e) {
    return jsonErr(res, 500, "get_failed", e instanceof Error ? e.message : String(e))
  }
})

/** GET /api/barbers/profile?name=Marcus%20Reed */
router.get("/profile", async (req, res) => {
  try {
    const name = String(req.query?.name || "").trim()
    if (!name) return jsonErr(res, 400, "name_required", "Query ?name= is required")
    const p = await getProfileByName(name)
    return res.json({ ok: true, profile: p })
  } catch (e) {
    return jsonErr(res, 500, "get_failed", e instanceof Error ? e.message : String(e))
  }
})

/** GET /api/barbers/:id — public single barber by numeric id */
router.get("/:id(\\d+)", async (req, res) => {
  try {
    const p = await getProfileById(req.params.id)
    if (!p) return jsonErr(res, 404, "not_found", "Profile not found")
    return res.json({ ok: true, profile: p, barber: p })
  } catch (e) {
    return jsonErr(res, 500, "get_failed", e instanceof Error ? e.message : String(e))
  }
})

/** POST /api/barbers/profiles — admin create */
router.post("/profiles", requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim()
    if (!name) return jsonErr(res, 400, "name_required", "name is required")
    const profile = await createProfile({
      name,
      bio: req.body?.bio,
      contactEmail: req.body?.contactEmail,
      contactPhone: req.body?.contactPhone,
      email: req.body?.email,
      phone: req.body?.phone,
      profileImageUrl: req.body?.profileImageUrl,
      gallery: req.body?.gallery,
    })
    return res.status(201).json({ ok: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.includes("duplicate") || msg.includes("unique")) {
      return jsonErr(res, 409, "name_taken", "A profile with this name already exists")
    }
    return jsonErr(res, 500, "create_failed", msg)
  }
})

/** PUT /api/barbers/profiles/:id — admin full update */
router.put("/profiles/:id", requireAdmin, async (req, res) => {
  try {
    const profile = await updateProfileById(req.params.id, {
      name: req.body?.name,
      bio: req.body?.bio,
      contactEmail: req.body?.contactEmail,
      contactPhone: req.body?.contactPhone,
      email: req.body?.email,
      phone: req.body?.phone,
      profileImageUrl: req.body?.profileImageUrl,
      gallery: req.body?.gallery,
    })
    return res.json({ ok: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "not_found") return jsonErr(res, 404, "not_found", "Profile not found")
    return jsonErr(res, 500, "update_failed", msg)
  }
})

/** PUT /api/barbers/:id — alias (numeric id only) */
router.put("/:id(\\d+)", requireAdmin, async (req, res) => {
  try {
    const profile = await updateProfileById(req.params.id, {
      name: req.body?.name,
      bio: req.body?.bio,
      contactEmail: req.body?.contactEmail,
      contactPhone: req.body?.contactPhone,
      email: req.body?.email,
      phone: req.body?.phone,
      profileImageUrl: req.body?.profileImageUrl,
      gallery: req.body?.gallery,
    })
    return res.json({ ok: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "not_found") return jsonErr(res, 404, "not_found", "Profile not found")
    return jsonErr(res, 500, "update_failed", msg)
  }
})

/** POST /api/barbers/profiles/:id/profile-image — multipart photo */
router.post("/profiles/:id/profile-image", requireAdmin, uploadMemory.single("photo"), async (req, res) => {
  try {
    const file = req.file
    if (!file?.buffer?.length) return jsonErr(res, 400, "photo_required", "photo file required")
    const cur = await getProfileById(req.params.id)
    if (!cur) return jsonErr(res, 404, "not_found", "Profile not found")
    const { url } = await uploadBarberStyleImage({
      buffer: file.buffer,
      mimetype: file.mimetype,
      barberName: cur.name,
      originalName: file.originalname || "profile.jpg",
    })
    const profile = await updateProfileById(req.params.id, { profileImageUrl: url })
    return res.json({ ok: true, profile, url })
  } catch (e) {
    return jsonErr(res, 500, "upload_failed", e instanceof Error ? e.message : String(e))
  }
})

/** POST /api/barbers/profiles/:id/gallery/url — JSON { url } */
router.post("/profiles/:id/gallery/url", requireAdmin, async (req, res) => {
  try {
    const url = String(req.body?.url || "").trim()
    if (!url) return jsonErr(res, 400, "url_required", "JSON body { url } is required")
    const profile = await addGalleryUrl(req.params.id, url)
    return res.json({ ok: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "not_found") return jsonErr(res, 404, "not_found", "Profile not found")
    return jsonErr(res, 500, "gallery_add_failed", msg)
  }
})

/** POST /api/barbers/profiles/:id/gallery/upload — multipart field photo */
router.post("/profiles/:id/gallery/upload", requireAdmin, uploadMemory.single("photo"), async (req, res) => {
  try {
    const cur = await getProfileById(req.params.id)
    if (!cur) return jsonErr(res, 404, "not_found", "Profile not found")
    const file = req.file
    if (!file?.buffer?.length) return jsonErr(res, 400, "photo_required", "photo file required")
    const { url } = await uploadBarberStyleImage({
      buffer: file.buffer,
      mimetype: file.mimetype,
      barberName: cur.name,
      originalName: file.originalname || "gallery.jpg",
    })
    const profile = await addGalleryUrl(req.params.id, url)
    return res.json({ ok: true, profile, url })
  } catch (e) {
    return jsonErr(res, 500, "gallery_add_failed", e instanceof Error ? e.message : String(e))
  }
})

/** DELETE /api/barbers/profiles/:id/gallery?url=encoded */
router.delete("/profiles/:id/gallery", requireAdmin, async (req, res) => {
  try {
    const url = String(req.query?.url || "").trim()
    if (!url) return jsonErr(res, 400, "url_required", "Query ?url= is required")
    const profile = await removeGalleryUrl(req.params.id, url)
    return res.json({ ok: true, profile })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "not_found") return jsonErr(res, 404, "not_found", "Profile not found")
    return jsonErr(res, 500, "gallery_remove_failed", msg)
  }
})

export default router
