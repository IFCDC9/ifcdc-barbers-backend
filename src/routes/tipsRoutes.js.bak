import express from"express";
const router = express.Router();

import db from "../db/db.js";

/*
POST TIP
POST /api/tips
*/
router.post("/", async (req, res) => {
const { barberId, clientId, amount, message } = req.body;

try {
const result = await db.query(
`INSERT INTO tips (barber_id, client_id, amount, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
[barberId, clientId, amount, message]
);

```
res.json({
  success: true,
  tip: result.rows[0],
});
```

} catch (error) {
console.error("TIP ERROR:", error);

```
res.status(500).json({
  success: false,
  message: "Failed to submit tip"
});
```

}
});

/*
GET TIPS FOR BARBER
GET /api/tips/:barberId
*/
router.get("/:barberId", async (req, res) => {
const { barberId } = req.params;

try {
const result = await db.query(
`SELECT * FROM tips
       WHERE barber_id = $1
       ORDER BY created_at DESC`,
[barberId]
);

```
res.json({
  success: true,
  tips: result.rows
});
```

} catch (error) {
console.error("GET TIPS ERROR:", error);

```
res.status(500).json({
  success: false,
  message: "Failed to fetch tips"
});
```

}
});

export default router

