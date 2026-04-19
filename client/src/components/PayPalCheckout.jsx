import React from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { Card } from "./ui/Card.jsx";
import { theme } from "./ui/theme.js";
import { apiUrl, apiPost, fetchWithTimeout } from "../lib/api.js";
import { SYSTEM_CONFIG } from "../config/systemConfig.js";
import ErrorBoundary from "./ErrorBoundary.jsx";

/**
 * PayPal Smart Buttons — requires PayPalScriptProvider (see main.jsx).
 * createOrder: POST /api/create-order when server PayPal env is set; otherwise client-side order.
 */
export default function PayPalCheckout({
  amount,
  navigate,
  bookingContext = null,
  slotCheck = null,
}) {
  const [busy, setBusy] = React.useState(false);

  const amt = React.useMemo(() => {
    const n = Number(amount);
    if (Number.isFinite(n) && n > 0) return Math.min(9999, n).toFixed(2);
    return String(amount ?? "20.00");
  }, [amount]);

  return (
    <Card style={{ marginTop: 14 }}>
      <div style={st.sectionTitle}>Pay with PayPal</div>
      <p style={st.mutedSmall}>
        Pay securely in USD. After approval we complete your booking when details are on file.
      </p>

      <div style={st.paypalHost} data-testid="paypal-buttons-host">
        <ErrorBoundary>
          <PayPalButtons
            style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
            disabled={busy}
            createOrder={async (_paypalData, actions) => {
              try {
                const res = await fetchWithTimeout(apiUrl("/api/create-order"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ amount: Number(amt), customId: "checkout" }),
                });
                const json = await res.json().catch(() => ({}));
                if (res.ok && json?.orderId) return json.orderId;
                console.warn("[ifcdc] create-order API unavailable, using client order:", json?.error || res.status);
              } catch (e) {
                console.warn("[ifcdc] create-order fetch failed, using client order:", e);
              }
              return actions.order.create({
                purchase_units: [
                  {
                    amount: {
                      currency_code: "USD",
                      value: amt,
                    },
                  },
                ],
              });
            }}
            onApprove={async (data, actions) => {
              setBusy(true);
              try {
                const details = await actions.order.capture();
                console.log("[ifcdc] Payment approved:", data, details);

                const capturedStatus = String(details?.status || "").toUpperCase();
                if (capturedStatus !== "COMPLETED") {
                  console.error("[ifcdc] capture status:", details?.status);
                  return;
                }

                await fetchWithTimeout(apiUrl("/api/verify-payment"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(details),
                }).catch((e) => console.warn("[ifcdc] verify-payment:", e));

                const res = await fetchWithTimeout(apiUrl("/api/payment-success"), {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    orderID: data.orderID,
                    payer: details.payer,
                  }),
                });
                const paymentBody = await res.json().catch(() => ({}));
                if (!res.ok || paymentBody.ok === false) {
                  console.error("[ifcdc] payment-success:", paymentBody?.message || paymentBody?.error || res.status);
                  return;
                }

                const captureId = details?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
                const amountStr = String(bookingContext?.payAmount ?? amt);
                const ctx = bookingContext;

                if (ctx?.barberName && ctx?.date && ctx?.time) {
                  const { availableTimes = [], time: slotTime, nextAvailable = "—" } = slotCheck || {};
                  if (availableTimes.length && !availableTimes.includes(slotTime)) {
                    console.warn("[ifcdc] slot no longer available:", { nextAvailable, orderID: data?.orderID });
                    return;
                  }

                  await apiPost("/api/bookings/confirm", {
                    paymentId: captureId || data?.orderID,
                    status: "COMPLETED",
                    email: "service@ifcdc.org",
                    phone: SYSTEM_CONFIG.BUSINESS_PHONE,
                    barberName: ctx.barberName,
                    date: ctx.date,
                    time: ctx.time,
                    amount: amountStr,
                    currency: "USD",
                    paypalOrderId: data?.orderID,
                    paypalCaptureId: captureId,
                  });

                  const qOk = new URLSearchParams({ barber: ctx.barberName, date: ctx.date, time: ctx.time });
                  if (data?.orderID) qOk.set("orderId", String(data.orderID));
                  navigate?.(`/confirmation?${qOk.toString()}`);
                } else {
                  alert("Payment successful!");
                }
              } catch (e) {
                console.error("[ifcdc] PayPal onApprove error:", e);
              } finally {
                setBusy(false);
              }
            }}
            onError={(err) => {
              console.error("[ifcdc] PayPal error:", err);
            }}
          />
        </ErrorBoundary>
      </div>
    </Card>
  );
}

const st = {
  paypalHost: {
    marginTop: 6,
    minHeight: 48,
    width: "100%",
    opacity: 1,
    visibility: "visible",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 900,
    color: theme.colors.text,
    marginBottom: 12,
  },
  mutedSmall: {
    color: theme.colors.muted,
    fontSize: 12,
    marginBottom: 10,
    lineHeight: 1.45,
  },
};
