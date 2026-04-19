import express from "express";
import cors from "cors";
import multer from "multer";
import fs from "fs";

fs.mkdirSync("uploads", { recursive: true });

const app = express();

app.use(cors());
app.use(express.json());

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

let barbers = [];

app.get("/barbers", (req, res) => {
  res.json(barbers);
});

app.post("/barbers", upload.array("images", 10), (req, res) => {
  const imageUrls = (req.files || []).map((file) => `/uploads/${file.filename}`);

  const newBarber = {
    id: Date.now(),
    name: req.body.name,
    images: imageUrls,
  };

  barbers.push(newBarber);
  res.json(newBarber);
});

app.use("/uploads", express.static("uploads"));

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "ifcdc-barbers-api" });
});

app.get("/voice", (req, res) => {
  res.set("Content-Type", "text/xml");
  res.send(`<Response><Say>Welcome to IFCDC</Say></Response>`);
});

app.listen(5050, () => {
  console.log("Backend running on port 5050");
});
