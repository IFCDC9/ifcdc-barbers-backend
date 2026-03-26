/* ==========================================
   IFCDC BARBERS PLATFORM SERVER
========================================== */

import "dotenv/config"
import express from "express"
import cors from "cors"
import http from "http"
import path from "path"
import { fileURLToPath } from "url"
import { Server } from "socket.io"
import pool from "./db/db.js"

/* ==========================================
   ROUTES
========================================== */

import dashboardRoutes from "./routes/dashboardRoutes.js"
import queueRoutes from "./routes/queueRoutes.js"
import barberStatusRoutes from "./routes/barberStatusRoutes.js"
import checkinRoutes from "./routes/checkinRoutes.js";
import earningsRoutes from "./routes/earningsRoutes.js"
import tipsRoutes from "./routes/tipsRoutes.js"
import waitTimeRoutes from "./routes/waitTimeRoutes.js"
import appointmentRoutes from "./routes/appointments.js"
import testRoutes from "./routes/testRoutes.js"
import voiceAiRoutes from "../server/routes/voice.ts"
import voiceRoutes from "./routes/voiceRoutes.js"
import receptionistRoutes from "./routes/receptionistRoutes.js"
import bookingRoutes from "./routes/bookingRoutes.js"
import paypalRoutes from "./routes/paypalRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import { attachTwilioRealtimeBridge } from "./services/realtimeVoice.js"
import { logStartupEnvDiagnostics } from "./config/envDiagnostics.js"

const app = express()
const server = http.createServer(app)
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.set("trust proxy", true)

const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

attachTwilioRealtimeBridge({
  server,
  path: "/api/voice/media-stream"
})

/* ==========================================
   PUBLIC ROUTES (very top — no cors / body parsers / API middleware)
   GET / and POST /voice must stay first on `app` so nothing can intercept them.
========================================== */

app.get("/", (_req, res) => {
  res.send("IFCDC Barbers Backend Running")
})

app.post("/voice", (_req, res) => {
  res.type("text/xml")
  res.send(`
    <Response>
      <Say>Welcome to IFCDC Barbers</Say>
    </Response>
  `)
})

/* Optional public probe (no /api middleware stack) */
app.get("/api/health", async (_req, res) => {
  let db = { ok: false, error: null }
  try {
    await pool.query("SELECT 1")
    db.ok = true
  } catch (err) {
    db.error = String(err?.code || err?.message || "db_unreachable")
  }

  res.json({
    ok: true,
    uptime: process.uptime(),
    db,
    openai: Boolean(process.env.OPENAI_API_KEY?.trim()),
    twilio: Boolean(
      process.env.TWILIO_ACCOUNT_SID?.trim()
      && process.env.TWILIO_AUTH_TOKEN?.trim()
      && process.env.TWILIO_PHONE_NUMBER?.trim()
    ),
    twilioSignatureValidation: process.env.TWILIO_VALIDATE_SIGNATURE === "true",
    twilioWebhooks: {
      smsIncoming: "POST /api/sms/incoming",
      smsIncomingAlt: "POST /api/voice/sms-incoming",
      voiceIncomingCall: "POST /api/voice/incoming-call",
      voiceProcess: "POST /api/voice/process",
      voiceStatus: "POST /api/voice/status"
    }
  })
})

/* CORS for everything after public handlers (does not run if a public route above already finished the response). */
app.use(cors())

/* ==========================================
   /api only — body parsers + route mounts
   requireAdmin, Twilio signature checks, etc. live on routers below (never on `app`).
========================================== */

const apiRouter = express.Router()

apiRouter.use(express.json())
apiRouter.use(express.urlencoded({ extended: true }))

apiRouter.use("/dashboard", dashboardRoutes)
apiRouter.use("/queue", queueRoutes)
apiRouter.use("/barber-status", barberStatusRoutes)
apiRouter.use(checkinRoutes)
apiRouter.use("/bookings", bookingRoutes)
apiRouter.use("/appointments", appointmentRoutes)
apiRouter.use("/paypal", paypalRoutes)
apiRouter.use("/earnings", earningsRoutes)
apiRouter.use("/tips", tipsRoutes)
apiRouter.use("/wait-time", waitTimeRoutes)
apiRouter.use("/test", testRoutes)
apiRouter.use("/admin", adminRoutes)
apiRouter.use("/receptionist", receptionistRoutes)
apiRouter.use("/voice", voiceAiRoutes)
apiRouter.use("/voice", voiceRoutes)

app.use("/api", apiRouter)

app.use("/admin", express.static(path.join(__dirname, "public")))

/* ==========================================
   DATABASE CONNECTION
========================================== */

pool.connect()
  .then((client) => {
    client.release()
    console.log("✅ IFCDC Database Connected")
  })
  .catch(err => {
    console.error("❌ Database connection error:", err)
  })

/* ==========================================
   SOCKET.IO REALTIME ENGINE
========================================== */

io.on("connection", (socket) => {

  console.log("⚡ Client connected")

  socket.on("joinBarberRoom", (barberId) => {
    socket.join(`barber-${barberId}`)
  })

  socket.on("disconnect", () => {
    console.log("Client disconnected")
  })

})

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"))
})

/* ==========================================
   SERVER START
========================================== */

const PORT = process.env.PORT || 5050

server.listen(PORT, () => {
  console.log(`🚀 IFCDC Server running on port ${PORT}`)
  logStartupEnvDiagnostics()
  console.log("[boot] Hot-reload: run `npm run dev` (nodemon watches src/ + server/)")
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`)
    console.error("Run: lsof -ti:5050 | xargs kill -9")
    process.exit(1)
  }

  console.error("❌ Server startup error:", error)
  process.exit(1)
})

let isShuttingDown = false

const isIgnorableShutdownError = (error) => {
  const code = String(error?.code || "")
  const message = String(error?.message || "")
  return (
    code === "ECONNRESET"
    || /connection terminated unexpectedly/i.test(message)
    || /read econreset/i.test(message)
  )
}

const shutdown = async (signal = "SIGTERM") => {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`)

  try {
    await new Promise((resolve) => {
      server.close(() => resolve())
    })
  } catch (error) {
    console.error("Error while closing HTTP server:", error)
  }

  try {
    await io.close()
  } catch (error) {
    console.error("Error while closing Socket.IO server:", error)
  }

  try {
    await pool.end()
  } catch (error) {
    console.error("Error while closing database pool:", error)
  }

  console.log("✅ Shutdown complete")
  process.exit(0)
}

process.on("SIGINT", () => {
  shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  shutdown("SIGTERM")
})

process.on("uncaughtException", (error) => {
  if (isShuttingDown && isIgnorableShutdownError(error)) {
    return
  }

  console.error("❌ Uncaught exception:", error)
  shutdown("uncaughtException")
})

process.on("unhandledRejection", (reason) => {
  if (isShuttingDown && isIgnorableShutdownError(reason)) {
    return
  }

  console.error("❌ Unhandled rejection:", reason)
  shutdown("unhandledRejection")
})