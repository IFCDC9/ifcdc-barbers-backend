
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const authRoutes = require("./routes/auth");
const appointmentRoutes = require("./routes/appointments");

const app = express();
const PORT = 5000;

console.log("Starting Express app...");


/* ===============================
   MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

console.log("Middleware loaded...");

/* ===============================
   QUICK LOGIN TEST ROUTE
================================ */
app.get("/test-login", (req, res) => {
  res.json({ message: "Test route working!" });
});

/* ===============================
   ROUTES
================================ */
app.use("/auth", authRoutes);
app.use("/appointments", appointmentRoutes);

/* ===============================
   ROOT HEALTH CHECK
================================ */
app.get("/", (req, res) => {
  console.log("Root route called");
  res.json({
    status: "IFCDC Backend Operational",
  });
});

app.get("/ping", (req, res) => {
  console.log("Ping route called");
  res.json({ message: "pong" });
});

/* ===============================
   DATABASE TEST ROUTE
================================ */
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      databaseTime: result.rows[0]
    });
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
app.get("/test-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      success: true,
      databaseTime: result.rows[0]
    });
  } catch (error) {
    console.error("Database test failed:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get("/debug-user", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, email, password FROM users WHERE email = $1",
      ["admin@ifcdc.org"]
    );
    
    if (result.rows.length === 0) {
      return res.json({ error: "User not found" });
    }
    
    const user = result.rows[0];
    res.json({
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      passwordLength: user.password?.length || 0,
      isHashed: user.password?.startsWith('$2') // bcrypt hashes start with $2
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "User not found" });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid password" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        email: user.email
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

console.log("About to start listening...");
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
