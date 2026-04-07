import multer from "multer"

const storage = multer.memoryStorage()

export const uploadMemory = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
})
