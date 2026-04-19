import ReactDOM from "react-dom/client";
import { PayPalScriptProvider } from "@paypal/react-paypal-js";
import App from "./App.jsx";
import ScreenErrorBoundary from "./components/ScreenErrorBoundary.jsx";
import "./styles/global.css";

/** Sandbox Client ID from https://developer.paypal.com/dashboard/applications/sandbox (must match environment). */
const PAYPAL_ID = String(import.meta.env.VITE_PAYPAL_CLIENT_ID ?? "").trim();
if (!PAYPAL_ID) {
  console.error(
    "[PayPal] Set VITE_PAYPAL_CLIENT_ID in client/.env to your Sandbox app Client ID, then restart Vite."
  );
}
/**
 * Sandbox → www.sandbox.paypal.com/sdk/js; production → www.paypal.com/sdk/js.
 * VITE_PAYPAL_ENVIRONMENT=production only with a Live app Client ID from the Live tab in the Dashboard.
 */
const PAYPAL_ENV =
  import.meta.env.VITE_PAYPAL_ENVIRONMENT === "production" ? "production" : "sandbox";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Missing #root — check index.html");
}

const paypalDebug =
  String(import.meta.env.VITE_PAYPAL_DEBUG ?? "").trim() === "true";

/** StrictMode disabled: React 18 double-mount can break PayPal SDK in dev. */
ReactDOM.createRoot(rootEl).render(
  <PayPalScriptProvider
    options={{
      "client-id": PAYPAL_ID,
      currency: "USD",
      ...(paypalDebug ? { debug: true } : {}),
      components: "buttons",
      intent: "capture",
      environment: PAYPAL_ENV,
    }}
  >
    <ScreenErrorBoundary>
      <App />
    </ScreenErrorBoundary>
  </PayPalScriptProvider>
);
