import express from "express"
import { requireAdmin } from "../middleware/requireAdmin.js"
import { getAboutContent, setAboutContent } from "../services/siteContentStore.js"

const router = express.Router()

/** GET /api/about — public */
router.get("/", async (_req, res) => {
  try {
    const content = await getAboutContent()
    return res.json({ ok: true, ...content })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

/** PUT /api/about — admin */
router.put("/", requireAdmin, async (req, res) => {
  try {
    const content = await setAboutContent({
      organizationBio: req.body?.organizationBio,
      mission: req.body?.mission,
      galleryUrls: req.body?.galleryUrls,
      videoUrl: req.body?.videoUrl,
    })
    return res.json({ ok: true, ...content })
  } catch (e) {
    return res.status(500).json({ ok: false, error: e instanceof Error ? e.message : String(e) })
  }
})

export default router
