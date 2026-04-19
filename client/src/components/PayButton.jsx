import React from "react";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { apiUrl, apiPost } from "../lib/api.js";
import { SYSTEM_CONFIG } from "../config/systemConfig.js";
import { PayPalReadyContext } from "./PayPalRoot.jsx";

/**
 * Client-side PayPal create → capture → POST /api/payment-success.
 * Booking is confirmed ONLY after: capture status COMPLETED, payment-success OK, then POST /api/bookings/confirm.
 */
export default function PayButton({
  amount,
  disabled = false,
  navigate,
  bookingContext = null,
  slotCheck = null,
  onSuccess,
  onError,
}) {
  const { ready } = React.useContext(PayPalReadyContext);
  const [busy, setBusy] = React.useState(false);

  const amt = React.useMemo(() => {
    const n = Number(amount);
    if (Number.isFinite(n) && n > 0) return Math.min(9999, n).toFixed(2);
    return String(amount || "0.00");
  }, [amount]);

  if (!ready) {
    return (
      <div style={st.missing}>
        PayPal is not configured. Wrap the app with PayPalScriptProvider (see main.jsx) and set a valid{" "}
        <code>client-id</code>.
      </div>
    );
  }

  const blockInteraction = disabled || busy;

  return (
    <div style={{ ...st.wrap, opacity: blockInteraction ? 0.55 : 1, pointerEvents: blockInteraction ? "none" : "auto" }}>
      <PayPalButtons
        style={{ layout: "vertical", color: "gold", shape: "rect", label: "paypal" }}
        disabled={blockInteraction}
        createOrder={(data, actions) => {
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
            // 1) PayPal capture must succeed with COMPLETED status (do not confirm booking before this).
            const details = await actions.order.capture();
            console.log("Payment success:", details);

            const capturedStatus = String(details?.status || "").toUpperCase();
            if (capturedStatus !== "COMPLETED") {
              throw new Error(`Payment not completed (status: ${details?.status || "unknown"})`);
            }

            // 2) Backend acknowledges payment before any booking write.
            const res = await fetch(apiUrl("/api/payment-success"), {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                orderID: data.orderID,
                payer: details.payer,
              }),
            });
            const paymentBody = await res.json().catch(() => ({}));
            if (!res.ok || paymentBody.ok === false) {
              throw new Error(
                paymentBody.message || paymentBody.error || `payment_success_failed HTTP_${res.status}`
              );
            }

            const captureId =
              details?.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
            const amountStr = String(bookingContext?.payAmount ?? amt);

            const ctx = bookingContext;
            if (ctx?.barberName && ctx?.date && ctx?.time) {
              const { availableTimes = [], time: slotTime, nextAvailable = "—" } = slotCheck || {};
              if (availableTimes.length && !availableTimes.includes(slotTime)) {
                const msg = `Payment went through, but this time slot is no longer available. Next available: ${nextAvailable}. Your PayPal order: ${data?.orderID || "—"}. Please contact us to reschedule.`;
                if (onError) onError(new Error(msg));
                else window.alert(msg);
                // Do not call /api/bookings/confirm or show a confirmed booking.
                return;
              }

              // 3) Only after PayPal + payment-success: create the confirmed booking.
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
              if (onSuccess) onSuccess({ orderId: data?.orderID, details });
              else window.alert("Payment successful!");
            }
          } catch (e) {
            const err = e instanceof Error ? e : new Error(String(e));
            console.error("PayPal post-capture error:", e);
            if (onError) onError(err);
            else window.alert(err.message || "payment_failed");
          } finally {
            setBusy(false);
          }
        }}
        onError={(err) => {
          console.error("PayPal error:", err);
          if (onError) onError(err instanceof Error ? err : new Error(String(err)));
        }}
      />
    </div>
  );
}

const st = {
  wrap: { marginTop: 6, minHeight: 48 },
  missing: {
    padding: 10,
    fontSize: 12,
    lineHeight: 1.45,
    color: "rgba(238,242,255,0.65)",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(0,0,0,0.2)",
  },
};
