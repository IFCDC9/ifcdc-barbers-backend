import { apiFullUrl } from "../constants/config";
import { getSupabase } from "../lib/supabase";

export type EnsureSupabaseAuthResult =
  | { ok: true; mode: "existing" | "bridge" | "anonymous" }
  | { ok: false; message: string };

/**
 * Ensures Supabase has an authenticated session (required for strict RLS).
 * 1) Reuse persisted session if valid
 * 2) If `appJwt` is set, exchange via POST /api/auth/supabase-bridge → signInWithPassword
 * 3) Else signInAnonymously (enable Anonymous provider in Supabase Dashboard)
 */
export async function ensureSupabaseAuth(appJwt: string | null): Promise<EnsureSupabaseAuthResult> {
  const sb = getSupabase();
  if (!sb) {
    return { ok: false, message: "Supabase client not configured" };
  }

  const { data: sessionData } = await sb.auth.getSession();
  if (sessionData.session?.user) {
    return { ok: true, mode: "existing" };
  }

  if (appJwt) {
    try {
      const res = await fetch(apiFullUrl("/api/auth/supabase-bridge"), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${appJwt}`,
          "Content-Type": "application/json",
        },
      });
      const json = (await res.json()) as {
        ok?: boolean;
        supabase?: { email?: string; password?: string };
        error?: string;
        detail?: string;
      };
      if (res.ok && json?.ok && json.supabase?.email && json.supabase?.password) {
        const { error } = await sb.auth.signInWithPassword({
          email: json.supabase.email,
          password: json.supabase.password,
        });
        if (!error) {
          return { ok: true, mode: "bridge" };
        }
      }
    } catch {
      /* fall through to anonymous */
    }
  }

  const { error } = await sb.auth.signInAnonymously();
  if (error) {
    return {
      ok: false,
      message:
        error.message ||
        "Anonymous sign-in failed — enable Anonymous auth in Supabase or sign into the app for JWT bridge.",
    };
  }
  return { ok: true, mode: "anonymous" };
}
