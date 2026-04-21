import { useEffect, useState } from "react";
import { safeApiGet } from "./api.js";

/**
 * E.164 (or raw digits) for Call/Text AURA in the UI.
 * Prefer `VITE_AURA_PHONE_NUMBER`; otherwise loads `auraPhone` from GET /api/config (server `AURA_PHONE_NUMBER`).
 */
export function useAuraContactPhone() {
  const envPhone = String(import.meta.env.VITE_AURA_PHONE_NUMBER || "").trim();
  const [serverPhone, setServerPhone] = useState("");

  useEffect(() => {
    if (envPhone) return;
    let cancelled = false;
    void (async () => {
      const j = await safeApiGet("/api/config");
      const p = j?.auraPhone != null ? String(j.auraPhone).trim() : "";
      if (!cancelled && p) setServerPhone(p);
    })();
    return () => {
      cancelled = true;
    };
  }, [envPhone]);

  return (envPhone || serverPhone).trim();
}
