import { useEffect, useState } from "react";
import { getApiOrigin } from "../services/api.js";
import { formatNanpUsDisplay, nanpDialString } from "../lib/formatNanp.js";
import { useDevice } from "../hooks/useDevice.js";
import { SYSTEM_CONFIG } from "../config/systemConfig.js";

export default function Phone() {
  const device = useDevice();
  const [phoneNumber, setPhoneNumber] = useState(SYSTEM_CONFIG.BUSINESS_PHONE);
  const [auraPhone, setAuraPhone] = useState("");
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const origin = getApiOrigin();
    fetch(`${origin}/api/config`, { headers: { Accept: "application/json" } })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
        }
        const p = data?.phone != null ? String(data.phone).trim() : "";
        const ap = data?.auraPhone != null ? String(data.auraPhone).trim() : "";
        if (!cancelled) {
          setPhoneNumber(p || SYSTEM_CONFIG.BUSINESS_PHONE);
          setAuraPhone(ap);
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err?.message || "Could not load phone number");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const callNow = () => {
    const raw = String(phoneNumber || "").trim();
    if (!raw) return;
    const dial = nanpDialString(raw);
    if (!dial) return;
    window.location.href = `tel:${dial}`;
  };

  const copyNumber = async () => {
    const raw = String(phoneNumber || "").trim();
    if (!raw) return;
    const toCopy = nanpDialString(raw) || raw;
    try {
      await navigator.clipboard.writeText(toCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      // Fallback: best-effort copy prompt
      window.prompt("Copy phone number:", toCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    }
  };

  const auraPhoneFormatted = formatNanpUsDisplay(auraPhone);

  return (
    <div className="page phone-page">
      <h1 className="phone-page__title">
        <span className="phone-page__title-icon" aria-hidden>
          ☎
        </span>
        <span className="phone-page__title-text">Phone</span>
      </h1>
      <p className="phone-page__lead">Call IFCDC Barbers — tap Call Now to open the dialer on your device.</p>

      {loading ? <p className="phone-page__status">Loading…</p> : null}
      {loadError ? <p className="phone-page__status phone-page__status--warn">{loadError}</p> : null}

      {!loading ? (
        <>
          <p className="phone-page__label">Business number</p>
          <p className="phone-page__number" aria-live="polite">
            {formatNanpUsDisplay(phoneNumber) || phoneNumber || "—"}
          </p>
          <div className={`phone-page__actions phone-page__actions--${device}`}>
            <button type="button" className="phone-page__cta" disabled={!phoneNumber} onClick={callNow}>
              Call Now
            </button>
            {device === "desktop" ? (
              <button type="button" className="phone-page__cta phone-page__cta--ghost" disabled={!phoneNumber} onClick={copyNumber}>
                {copied ? "Copied" : "Copy"}
              </button>
            ) : null}
          </div>
          {!phoneNumber ? (
            <p className="phone-page__status phone-page__status--warn">
              Set <code className="phone-page__code">BUSINESS_PHONE</code> or <code className="phone-page__code">VITE_BUSINESS_PHONE</code> in{" "}
              <code className="phone-page__code">.env</code> and restart.
            </p>
          ) : null}
        </>
      ) : null}

      <div className="ai-box">
        <h2>Need help?</h2>
        <p>
          Tap the floating <strong className="phone-page__aura-name">AURA</strong> button (bottom-right) for booking help and
          answers.
        </p>
        {auraPhone ? (
          <div className="phone-page__aura-contact-block">
            <p className="phone-page__aura-contact">
              <a href={`tel:${nanpDialString(auraPhone)}`} className="phone-page__aura-contact-link">
                Call AURA
              </a>
              {" · "}
              <a href={`sms:${nanpDialString(auraPhone)}`} className="phone-page__aura-contact-link">
                Text AURA
              </a>
            </p>
            {auraPhoneFormatted ? (
              <p className="phone-page__aura-display" aria-label={`AURA ${auraPhoneFormatted}`}>
                {auraPhoneFormatted}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
