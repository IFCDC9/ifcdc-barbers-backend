/** User-visible checkout error from API / network failures. */
export function formatCheckoutError(err: unknown): string {
  const e = err as {
    message?: string;
    code?: string;
    status?: number | string;
    url?: string;
    details?: {
      error?: string;
      message?: string;
      paypal?: { environment?: string };
    };
  };
  const parts: string[] = [];
  const msg = String(e?.message || e || "").trim();
  if (msg) parts.push(msg);
  if (e?.code && e.code !== msg) parts.push(`Code: ${e.code}`);
  if (e?.status != null) parts.push(`HTTP ${e.status}`);
  const paypalEnv = e?.details?.paypal?.environment;
  if (paypalEnv) parts.push(`PayPal env: ${paypalEnv}`);
  const apiMsg = e?.details?.message;
  if (apiMsg && apiMsg !== msg) parts.push(String(apiMsg));
  if (parts.length) return parts.join("\n");
  return "Payment system unavailable. Please try again.";
}
