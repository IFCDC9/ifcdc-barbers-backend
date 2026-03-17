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
import voiceRoutes from "./routes/voiceRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js"
import paypalRoutes from "./routes/paypalRoutes.js"
import adminRoutes from "./routes/adminRoutes.js"
import { attachTwilioRealtimeBridge } from "./services/realtimeVoice.js"

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
   MIDDLEWARE
========================================== */

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
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

/* ==========================================
   API ROUTES
========================================== */

app.use("/api/dashboard", dashboardRoutes)
app.use("/api/queue", queueRoutes)
app.use("/api/barber-status", barberStatusRoutes)
app.use("/api", checkinRoutes);

/* Booking System */
app.use("/api/bookings", bookingRoutes)
app.use("/api/appointments", appointmentRoutes)
app.use("/api/paypal", paypalRoutes)

/* Financial System */
app.use("/api/earnings", earningsRoutes)
app.use("/api/tips", tipsRoutes)

/* Wait Time Engine */
app.use("/api/wait-time", waitTimeRoutes)

/* Diagnostics */
app.use("/api/test", testRoutes)
app.use("/api/admin", adminRoutes)

/* Voice Assistant */
app.use("/api/voice", voiceRoutes);

/* ==========================================
   ROOT ROUTE
========================================== */

const router = express.Router()

router.get("/", (req, res) => {
  res.json({
    platform: "IFCDC Barbers Platform",
    status: "running",
    version: "1.0"
  })
})

app.use("/", router)

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"))
})

/* ==========================================
   SERVER START
========================================== */

const PORT = process.env.PORT || 3000

server.listen(PORT, () => {
  console.log(`🚀 IFCDC Server running on port ${PORT}`)
})

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`❌ Port ${PORT} is already in use.`)
    console.error("Run: lsof -ti:3000 | xargs kill -9")
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