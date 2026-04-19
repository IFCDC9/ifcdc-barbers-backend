import React from "react";
import { apiPost } from "../lib/api.js";

/**
 * After full-page PayPal redirect, user returns to `/?token=ORDER_ID&PayerID=...`.
 * Captures the order server-side and navigates to #/confirmation with booking context from sessionStorage.
 */
export default function PayPalReturnHandler({ navigate }) {
  const doneRef = React.useRef(false);

  React.useEffect(() => {
    if (doneRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("paypal_cancel")) {
      window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
      return;
    }
    const token = sp.get("token");
    if (!token) return;
    doneRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const r = await apiPost("/api/paypal/capture-order", { orderId: token });
        if (cancelled) return;
        window.history.replaceState({}, document.title, window.location.pathname);
        let pending = {};
        try {
          pending = JSON.parse(sessionStorage.getItem("ifcdc_checkout") || "{}");
        } catch {
          pending = {};
        }
        sessionStorage.removeItem("ifcdc_checkout");
        const barber = pending.barberName || pending.barber || "";
        const date = pending.date || "";
        const time = pending.time || "";
        const orderId = r?.orderId || token;
        const q = new URLSearchParams({
          barber,
          date,
          time,
          orderId: String(orderId),
        });
        navigate(`/confirmation?${q.toString()}`);
      } catch (e) {
        console.error("[ifcdc] PayPal return capture failed:", e);
        alert("Payment could not be completed. Try again or use PayPal on the checkout page.");
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return null;
}
