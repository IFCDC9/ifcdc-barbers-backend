import React from "react";
import { signOutSupabase } from "../lib/supabase";
import { decodeJwtPayload, isOwnerAdminDashboardPayload } from "../auth/jwtSession";
import { getAuthToken, setAuthToken } from "./authService";

export type SessionKind = "owner" | "default";

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  sessionKind: SessionKind;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

function tokenToSessionKind(t: string | null): SessionKind {
  if (!t) return "default";
  const payload = decodeJwtPayload(t);
  return isOwnerAdminDashboardPayload(payload) ? "owner" : "default";
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState<string | null>(null);
  const [sessionKind, setSessionKind] = React.useState<SessionKind>("default");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const t = await getAuthToken();
      setToken(t);
      setSessionKind(tokenToSessionKind(t));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const signInWithToken = React.useCallback(async (t: string) => {
    try {
      await setAuthToken(t);
      setToken(t);
      setSessionKind(tokenToSessionKind(t));
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      console.error("[auth] SecureStore setItemAsync failed:", raw);
      const hint =
        /user_cancel|UserCancel|cancel/i.test(raw)
          ? "Sign-in was cancelled before the session could be saved."
          : "Token save failed. Try again, restart the app, or check device storage / Screen Time restrictions.";
      throw new Error(hint);
    }
  }, []);

  const signOut = React.useCallback(async () => {
    await signOutSupabase();
    await setAuthToken(null);
    setToken(null);
    setSessionKind("default");
  }, []);

  const value: AuthContextValue = { loading, token, sessionKind, signInWithToken, signOut, refresh };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
