const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const router = express.Router();

// Temporary in-memory store (we'll replace with DB next phase)
let users = [];

/* ===========================
   REGISTER
=========================== */
router.post("/register", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }

  const existingUser = users.find(u => u.email === email);
  if (existingUser) {
    return res.status(400).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  users.push({
    email,
    password: hashedPassword,
    resetToken: null,
    resetTokenExpiry: null
  });

  res.json({ message: "User registered successfully" });
});

/* ===========================
   LOGIN
=========================== */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: "User not found" });

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(400).json({ error: "Invalid password" });
  }

  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "1h" });

  res.json({ message: "Login successful", token });
});

/* ===========================
   FORGOT PASSWORD
=========================== */
router.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  const user = users.find(u => u.email === email);
  if (!user) return res.status(400).json({ error: "User not found" });

  const resetToken = crypto.randomBytes(32).toString("hex");

  user.resetToken = resetToken;
  user.resetTokenExpiry = Date.now() + 1000 * 60 * 15; // 15 minutes

  res.json({
    message: "Reset token generated",
    resetToken
  });
});

/* ===========================
   RESET PASSWORD
=========================== */
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  const user = users.find(
    u =>
      u.resetToken === token &&
      u.resetTokenExpiry > Date.now()
  );

  if (!user) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetToken = null;
  user.resetTokenExpiry = null;

  res.json({ message: "Password reset successful" });
});

module.exports = router;