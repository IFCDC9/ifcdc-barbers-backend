import React from "react";
import Checkout from "./Checkout.jsx";

/**
 * Hash route `#/payment?...` — same checkout + PayPal flow as `#/checkout?...`
 * (explicit payment step; avoids “Proceed” going nowhere if only `/payment` is wired).
 */
export default function PaymentPage(props) {
  return <Checkout {...props} />;
}
