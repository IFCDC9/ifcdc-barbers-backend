/**
 * PayPal capture refunds — uses capture ID stored on bookings.paypal_capture_id.
 */
const { getPayPalEnvironmentMeta, getPayPalAccessToken } = require("./paypalEnv.cjs");

function round2(n) {
  return Math.round(Number(n) * 100) / 100;
}

/**
 * @param {string} captureId
 * @param {{ amount?: number|null, currency?: string, note?: string }} [opts]
 * @returns {Promise<{ ok: boolean, refundId?: string, status?: string, amount?: number, raw?: object, error?: string, message?: string }>}
 */
async function refundPayPalCapture(captureId, opts = {}) {
  const id = String(captureId || "").trim();
  if (!id) {
    return { ok: false, error: "missing_capture_id", message: "PayPal capture id is required" };
  }

  const meta = getPayPalEnvironmentMeta();
  const url = `${meta.apiBase}/v2/payments/captures/${encodeURIComponent(id)}/refund`;

  let accessToken;
  try {
    accessToken = await getPayPalAccessToken();
  } catch (e) {
    return {
      ok: false,
      error: e.code || "paypal_oauth_failed",
      message: e.message || "PayPal authentication failed",
    };
  }

  const body = {};
  const amountNum = opts.amount != null && Number.isFinite(Number(opts.amount)) ? round2(opts.amount) : null;
  if (amountNum != null && amountNum > 0) {
    body.amount = {
      value: amountNum.toFixed(2),
      currency_code: String(opts.currency || "USD").toUpperCase(),
    };
  }
  const note = String(opts.note || "").trim();
  if (note) body.note_to_payer = note.slice(0, 255);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text.slice(0, 500) };
  }

  if (!res.ok) {
    const issue = Array.isArray(parsed?.details) ? parsed.details[0] : null;
    return {
      ok: false,
      error: parsed.name || parsed.error || `http_${res.status}`,
      message: issue?.description || parsed.message || parsed.error_description || "PayPal refund failed",
      raw: parsed,
    };
  }

  const refundedValue = Number(parsed?.amount?.value);
  return {
    ok: true,
    refundId: parsed.id || null,
    status: parsed.status || null,
    amount: Number.isFinite(refundedValue) ? round2(refundedValue) : amountNum,
    raw: parsed,
  };
}

module.exports = { refundPayPalCapture, round2 };
