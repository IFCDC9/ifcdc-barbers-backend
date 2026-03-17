import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import db from "./db/db.js"

import tipsRoutes from "./routes/tipsRoutes.js"
import queueRoutes from "./routes/queueRoutes.js"
import earningsRoutes from "./routes/earningsRoutes.js"
import waitTimeRoutes from "./routes/waitTimeRoutes.js"
import barberStatusRoutes from "./routes/barberStatusRoutes.js"
import dashboardRoutes from "./routes/dashboardRoutes.js"
import checkinRoutes from "./routes/checkinRoutes.js"
import barberMediaRoutes from "./routes/barberMediaRoutes.js"

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

/*
=========================
API ROUTES
=========================
*/

app.use("/api/tips", tipsRoutes)
app.use("/api/queue", queueRoutes)
app.use("/api/earnings", earningsRoutes)
app.use("/api/wait-time", waitTimeRoutes)
app.use("/api/barber-status", barberStatusRoutes)
app.use("/api/dashboard", dashboardRoutes)
app.use("/api", checkinRoutes)
app.use("/api/barber-media", barberMediaRoutes)

/*
=========================
HEALTH TEST ROUTE
=========================
*/

app.get("/api/health", (req, res) => {
  res.json({
    status: "IFCDC BARBERS API RUNNING"
  })
})

const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
