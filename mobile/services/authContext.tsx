import React from "react";
import { signOutSupabase } from "../lib/supabase";
import { getAuthToken, setAuthToken } from "./authService";

type AuthContextValue = {
  loading: boolean;
  token: string | null;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = React.useState(true);
  const [token, setToken] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const t = await getAuthToken();
      setToken(t);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const signInWithToken = React.useCallback(async (t: string) => {
    await setAuthToken(t);
    setToken(t);
  }, []);

  const signOut = React.useCallback(async () => {
    await signOutSupabase();
    await setAuthToken(null);
    setToken(null);
  }, []);

  const value: AuthContextValue = { loading, token, signInWithToken, signOut, refresh };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

