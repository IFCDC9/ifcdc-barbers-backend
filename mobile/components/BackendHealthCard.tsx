import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BACKEND_URL, isSupabaseConfigured } from "../constants/config";
import { getSupabase } from "../lib/supabase";

export default function BackendHealthCard() {
  const [apiOk, setApiOk] = React.useState<boolean | null>(null);
  const [supaOk, setSupaOk] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/health`, { method: "GET" });
        if (!cancelled) setApiOk(r.ok);
      } catch {
        if (!cancelled) setApiOk(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const sb = getSupabase();
    if (!isSupabaseConfigured || !sb) {
      setSupaOk(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { error } = await sb.from("appointments").select("id", { count: "exact", head: true });
      if (!cancelled) setSupaOk(!error);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <Text style={styles.line}>
          API {BACKEND_URL ? `(${BACKEND_URL.replace(/^https?:\/\//, "").slice(0, 28)}…)` : "(not set)"}:
        </Text>
        {apiOk === null ? (
          <ActivityIndicator size="small" color="#888" />
        ) : (
          <Text style={styles.line}>{apiOk ? " reachable" : " unreachable"}</Text>
        )}
      </View>
      <Text style={styles.line}>
        Supabase:{" "}
        {!isSupabaseConfigured
          ? "not configured"
          : supaOk === null
            ? "checking…"
            : supaOk
              ? "connected (appointments readable)"
              : "error — check RLS / URL / key"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6, paddingVertical: 4 },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  line: { color: "rgba(255,255,255,0.75)", fontSize: 13 },
});

