import React from "react";
import { Link } from "react-router-dom";

/**
 * PayPal checkout lives on /booking only (single PayPalScriptProvider — no duplicate SDK).
 */
export default function Payments() {
  return (
    <div className="booking-page">
      <header className="booking-page__header">
        <h1 className="booking-page__title">Payments</h1>
        <p className="booking-page__lead">
          Checkout and PayPal run on the Booking page so only one SDK loads.
        </p>
      </header>
      <section className="booking-page__card" aria-labelledby="payments-redirect-title">
        <h2 id="payments-redirect-title" className="booking-page__card-title">
          Book &amp; pay
        </h2>
        <p className="payments-page__note">
          Go to <strong>Booking</strong>, fill the form, then continue to payment — PayPal
          appears there.
        </p>
        <p className="payments-page__cta-wrap">
          <Link to="/booking" className="booking-page__submit payments-page__cta">
            Open booking
          </Link>
        </p>
      </section>
    </div>
  );
}
