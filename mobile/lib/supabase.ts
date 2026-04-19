import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "../constants/config";

let singleton: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (singleton) return singleton;
  singleton = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: typeof window !== "undefined",
    },
  });
  return singleton;
}

/** Clear Supabase session (call on app sign-out). */
export async function signOutSupabase(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
