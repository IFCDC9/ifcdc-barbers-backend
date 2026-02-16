const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;


// Health check route
app.get("/", (req, res) => {
  res.json({ message: "IFCDC Barbers Backend Running" });
});

// Booking route
app.post("/book", (req, res) => {
  const { name, service, date } = req.body;

  if (!name || !service || !date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  res.json({
    success: true,
    booking: {
      name,
      service,
      date,
    },
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
