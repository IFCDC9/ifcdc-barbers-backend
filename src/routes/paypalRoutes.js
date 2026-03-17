import express from "express"
import { createPayPalOrder, capturePayPalOrder } from "../services/paypalService.js"

const router = express.Router()

router.post("/create-paypal-order", async (req, res) => {
  try {
    const { bookingId, price } = req.body
    const data = await createPayPalOrder(bookingId, price)
    return res.json(data)
  } catch (err) {
    console.error("❌ Create Order Error:", err)
    return res.status(500).json({ error: err.message || "PayPal order failed" })
  }
})

router.post("/capture-paypal-order", async (req, res) => {
  try {
    const { orderId, bookingId } = req.body
    const data = await capturePayPalOrder(orderId, bookingId)

    if (data?.status === "COMPLETED") {
      console.log("💰 Payment confirmed for booking:", bookingId)
      return res.json({ success: true })
    }

    return res.status(400).json({ error: "Payment not completed" })
  } catch (err) {
    console.error("❌ Capture Error:", err)
    return res.status(500).json({ error: err.message || "Capture failed" })
  }
})

// 🌐 GET /checkout — server-rendered PayPal button page (used by mobile WebView)
router.get("/checkout", (req, res) => {
  const { bookingId, price, backendUrl } = req.query
  const clientId = process.env.PAYPAL_CLIENT_ID

  if (!bookingId || !price) {
    return res.status(400).send("<h3>Missing bookingId or price</h3>")
  }

  // Resolve the backend URL for API calls from within the page
  const apiBase =
    backendUrl ||
    process.env.VOICE_WEBHOOK_BASE_URL ||
    `http://localhost:${process.env.PORT || 3000}`

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>IFCDC Barbers — Checkout</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #0a0a0a;
      color: #f5f5f5;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: #1a1a1a;
      border-radius: 16px;
      padding: 32px 24px;
      width: 100%;
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    }
    .logo { font-size: 28px; font-weight: 800; color: #f5c842; letter-spacing: 1px; margin-bottom: 4px; }
    .subtitle { font-size: 14px; color: #888; margin-bottom: 24px; }
    .divider { border: none; border-top: 1px solid #2a2a2a; margin: 20px 0; }
    .row { display: flex; justify-content: space-between; font-size: 15px; margin-bottom: 10px; }
    .row .label { color: #aaa; }
    .row .value { font-weight: 600; }
    .total .value { color: #f5c842; font-size: 20px; }
    #paypal-button-container { margin-top: 24px; }
    #status { text-align: center; padding: 16px; border-radius: 10px; font-size: 15px; display: none; }
    #status.success { background: #1a3a1a; color: #5cb85c; display: block; }
    #status.error   { background: #3a1a1a; color: #e05252; display: block; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">✂️ IFCDC</div>
    <div class="subtitle">Secure Checkout</div>
    <hr class="divider" />
    <div class="row"><span class="label">Booking #</span><span class="value">${bookingId}</span></div>
    <div class="row"><span class="label">Service</span><span class="value">Haircut</span></div>
    <div class="row total"><span class="label">Total</span><span class="value">$${price}</span></div>
    <hr class="divider" />
    <div id="paypal-button-container"></div>
    <div id="status"></div>
  </div>

  <script src="https://www.paypal.com/sdk/js?client-id=${clientId}&currency=USD"></script>
  <script>
    const BACKEND = "${apiBase}";
    const bookingId = "${bookingId}";
    const price = "${price}";
    const statusEl = document.getElementById("status");

    paypal.Buttons({
      createOrder: async () => {
        const res = await fetch(BACKEND + "/api/paypal/create-paypal-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, price })
        });
        const data = await res.json();
        if (!data.id) throw new Error(data.error || "Order creation failed");
        return data.id;
      },

      onApprove: async (data) => {
        const res = await fetch(BACKEND + "/api/paypal/capture-paypal-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: data.orderID })
        });
        const result = await res.json();
        if (result.success) {
          statusEl.className = "success";
          statusEl.textContent = "✅ Payment confirmed! Your booking is set.";
          // Notify React Native WebView if running in-app
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: "PAYMENT_SUCCESS",
              bookingId,
              orderId: data.orderID
            }));
          }
        } else {
          throw new Error("Capture failed");
        }
      },

      onError: (err) => {
        statusEl.className = "error";
        statusEl.textContent = "❌ Payment failed. Please try again.";
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "PAYMENT_ERROR", error: String(err) }));
        }
      },

      onCancel: () => {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "PAYMENT_CANCELLED" }));
        }
      }
    }).render("#paypal-button-container");
  </script>
</body>
</html>`

  res.setHeader("Content-Type", "text/html")
  res.send(html)
})

export default router
