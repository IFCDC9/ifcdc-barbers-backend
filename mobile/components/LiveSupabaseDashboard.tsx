import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { isSupabaseConfigured } from "../constants/config";
import { useSupabaseRealtimeTable } from "../hooks/useSupabaseRealtimeTable";
import { useAuth } from "../services/authContext";
import { ensureSupabaseAuth } from "../services/supabaseAuth";
import { theme } from "../constants/theme";
import GlowButton from "./GlowButton";
import StylePhotoUploadCard from "./StylePhotoUploadCard";

function str(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  if (v === null || v === undefined) return "—";
  return String(v);
}

export default function LiveSupabaseDashboard() {
  const { token } = useAuth();
  const [sbAuthReady, setSbAuthReady] = useState(false);
  const [sbAuthMessage, setSbAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let cancelled = false;
    (async () => {
      const r = await ensureSupabaseAuth(token);
      if (cancelled) return;
      if (!r.ok) {
        setSbAuthMessage(r.message);
      } else {
        setSbAuthMessage(null);
      }
      setSbAuthReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const dataEnabled = isSupabaseConfigured && sbAuthReady && !sbAuthMessage;

  const appointments = useSupabaseRealtimeTable("appointments", {
    enabled: dataEnabled,
    orderColumn: "id",
    orderAscending: false,
    limit: 50,
  });
  const customers = useSupabaseRealtimeTable("customers", {
    enabled: dataEnabled,
    orderColumn: "id",
    orderAscending: false,
    limit: 100,
  });
  const photos = useSupabaseRealtimeTable("barber_style_photos", {
    enabled: dataEnabled,
    orderColumn: "id",
    orderAscending: false,
    limit: 60,
  });

  const [clientPhone, setClientPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [savingClient, setSavingClient] = useState(false);

  const saveClient = async () => {
    const phone = clientPhone.replace(/\D/g, "");
    if (phone.length < 10) {
      Alert.alert("Clients", "Enter a valid phone number (at least 10 digits).");
      return;
    }
    if (!customers.supabase) {
      Alert.alert("Clients", "Supabase is not configured.");
      return;
    }
    setSavingClient(true);
    try {
      const { error } = await customers.supabase
        .from("customers")
        .upsert(
          { phone, name: clientName.trim() || null },
          { onConflict: "phone" }
        );
      if (error) throw new Error(error.message);
      setClientPhone("");
      setClientName("");
    } catch (e) {
      Alert.alert("Clients", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingClient(false);
    }
  };

  if (!appointments.configured) {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Live data (Supabase)</Text>
        <Text style={styles.bannerBody}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (or app.json extra.supabaseUrl /
          supabaseAnonKey). Run src/db/supabase_realtime_rls.sql in the Supabase SQL editor. Enable Anonymous
          sign-ins for guests, or rely on POST /api/auth/supabase-bridge (requires SUPABASE_SERVICE_ROLE_KEY on the
          API) for JWT-linked sessions.
        </Text>
      </View>
    );
  }

  if (!sbAuthReady) {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Connecting to Supabase…</Text>
        <ActivityIndicator color={theme.colors.gold} style={{ marginTop: 12 }} />
      </View>
    );
  }

  if (sbAuthMessage) {
    return (
      <View style={styles.banner}>
        <Text style={styles.bannerTitle}>Supabase auth failed</Text>
        <Text style={styles.bannerBody}>{sbAuthMessage}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.h2}>Live from Supabase</Text>
      <Text style={styles.muted}>
        Bookings (appointments), clients (customers), and style photos update automatically when the database
        changes. Access uses your app JWT via /api/auth/supabase-bridge when logged in, or anonymous Supabase auth.
        Express continues to use Postgres directly (bypasses RLS) for PayPal, Twilio, and admin tools.
      </Text>

      <SectionTitle title="Bookings · appointments" />
      {appointments.error ? <Text style={styles.err}>{appointments.error}</Text> : null}
      {appointments.loading && !appointments.rows.length ? (
        <ActivityIndicator color={theme.colors.gold} />
      ) : (
        <ScrollView horizontal nestedScrollEnabled style={styles.rowScroll}>
          {appointments.rows.map((r) => (
            <View key={String(r.id)} style={styles.card}>
              <Text style={styles.cardTitle}>#{str(r, "id")}</Text>
              <Text style={styles.cardLine}>{str(r, "customer_name")}</Text>
              <Text style={styles.cardMuted}>{str(r, "service")}</Text>
              <Text style={styles.cardMuted}>
                {str(r, "date")} {str(r, "time")}
              </Text>
              <Text style={styles.tag}>{str(r, "status")}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <SectionTitle title="Clients · customers" />
      {customers.error ? <Text style={styles.err}>{customers.error}</Text> : null}
      <View style={styles.formRow}>
        <TextInput
          style={styles.input}
          placeholder="Phone (digits)"
          placeholderTextColor={theme.colors.textMuted}
          keyboardType="phone-pad"
          value={clientPhone}
          onChangeText={setClientPhone}
        />
        <TextInput
          style={styles.input}
          placeholder="Name"
          placeholderTextColor={theme.colors.textMuted}
          value={clientName}
          onChangeText={setClientName}
        />
        <GlowButton
          label="Save client"
          loading={savingClient}
          onPress={() => void saveClient()}
        />
      </View>
      {customers.loading && !customers.rows.length ? (
        <ActivityIndicator color={theme.colors.gold} />
      ) : (
        <View style={styles.list}>
          {customers.rows.slice(0, 12).map((r) => (
            <Text key={String(r.id)} style={styles.listItem}>
              {str(r, "name")} · {str(r, "phone")}
            </Text>
          ))}
        </View>
      )}

      <SectionTitle title="Photos · barber_style_photos" />
      {photos.supabase ? (
        <StylePhotoUploadCard supabase={photos.supabase} onUploaded={() => void photos.refresh()} />
      ) : null}
      {photos.error ? <Text style={styles.err}>{photos.error}</Text> : null}
      {photos.loading && !photos.rows.length ? (
        <ActivityIndicator color={theme.colors.gold} />
      ) : (
        <ScrollView horizontal nestedScrollEnabled style={styles.photoRow}>
          {photos.rows
            .filter((r) => str(r, "image_url") !== "—")
            .map((r) => (
              <View key={String(r.id)} style={styles.photoCard}>
                <Image source={{ uri: String(r.image_url) }} style={styles.thumb} />
                <Text style={styles.photoCap} numberOfLines={2}>
                  {str(r, "style_name")}
                </Text>
              </View>
            ))}
        </ScrollView>
      )}
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.section}>{title}</Text>;
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginTop: 8 },
  h2: { color: theme.colors.text, fontSize: 18, fontWeight: "700" },
  muted: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  section: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 14,
  },
  banner: {
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.35)",
    borderRadius: 14,
    padding: 14,
    backgroundColor: "#0d0d0d",
  },
  bannerTitle: { color: theme.colors.gold, fontWeight: "800", marginBottom: 6 },
  bannerBody: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  err: { color: "#f66", fontSize: 12, marginBottom: 6 },
  rowScroll: { flexGrow: 0 },
  card: {
    width: 160,
    padding: 10,
    marginRight: 10,
    borderRadius: 12,
    backgroundColor: "#111",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardTitle: { color: theme.colors.text, fontWeight: "700" },
  cardLine: { color: theme.colors.text, fontSize: 13, marginTop: 4 },
  cardMuted: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  tag: { color: theme.colors.gold, fontSize: 11, marginTop: 6, fontWeight: "600" },
  formRow: { gap: 10 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: theme.colors.text,
    fontSize: 15,
  },
  list: { gap: 6 },
  listItem: { color: theme.colors.textMuted, fontSize: 13 },
  photoRow: { flexGrow: 0, marginTop: 6 },
  photoCard: { width: 100, marginRight: 10 },
  thumb: { width: 100, height: 100, borderRadius: 10, backgroundColor: "#222" },
  photoCap: { color: theme.colors.textMuted, fontSize: 11, marginTop: 4 },
});
