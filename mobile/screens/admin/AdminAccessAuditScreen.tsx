import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { AdminStackParamList } from "../../navigation/AdminStack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import AuditEventCard from "../../components/AuditEventCard";
import GlowButton from "../../components/GlowButton";
import {
  fetchAuditLogs,
  type AuditCategoryFilter,
  type AuditEventRow,
  type AuditSummary,
  type AuditTimeFilter,
} from "../../services/adminAuditApi";
import {
  buildAuditCsv,
  filterEventsByCategory,
  filterEventsByTime,
} from "../../services/adminAuditLocalStore";
import { theme } from "../../constants/theme";
import { UX } from "../../utils/uxCopy";

const TIME_FILTERS: { key: AuditTimeFilter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
];

const CATEGORY_FILTERS: { key: AuditCategoryFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "security", label: "Security" },
  { key: "payments", label: "Payments" },
  { key: "users", label: "User actions" },
  { key: "bookings", label: "Booking actions" },
  { key: "admin", label: "Admin" },
];

function SummaryTile({ label, value, accent }: { label: string; value: number; accent?: "gold" | "danger" | "neon" }) {
  const valueStyle =
    accent === "danger" ? styles.summaryValueDanger : accent === "neon" ? styles.summaryValueNeon : styles.summaryValue;
  return (
    <View style={styles.summaryTile}>
      <Text style={valueStyle}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

type AuditRoute = RouteProp<AdminStackParamList, "AdminAccessAuditScreen">;

export default function AdminAccessAuditScreen() {
  const route = useRoute<AuditRoute>();
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(route.params?.initialSearch ?? "");
  const [timeFilter, setTimeFilter] = useState<AuditTimeFilter>("7d");
  const [categoryFilter, setCategoryFilter] = useState<AuditCategoryFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditLogs(timeFilter, categoryFilter);
      setSummary(data.summary);
      setEvents(data.events);
    } finally {
      setLoading(false);
    }
  }, [timeFilter, categoryFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    let rows = filterEventsByTime(events, timeFilter);
    rows = filterEventsByCategory(rows, categoryFilter);
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (e) =>
        e.user.toLowerCase().includes(q) ||
        e.action.toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        (e.detail || "").toLowerCase().includes(q),
    );
  }, [events, search, timeFilter, categoryFilter]);

  const handleExport = async () => {
    const csv = buildAuditCsv(filtered);
    try {
      await Share.share({
        message: `IFCDC Audit Log (${filtered.length} events)\n\n${csv.slice(0, 4000)}${csv.length > 4000 ? "\n…" : ""}`,
        title: "IFCDC audit export",
      });
    } catch {
      Alert.alert(
        "Export audit log",
        UX.shareUnavailable,
      );
    }
  };

  return (
    <ProfileScreenLayout title="Admin Access Audit" subtitle="Security & operations console" headerTopPad={12}>
      {summary ? (
        <ProfileCard style={[styles.summaryCard, styles.glass]}>
          <Text style={styles.sectionTitle}>Security summary</Text>
          <View style={styles.summaryGrid}>
            <SummaryTile label="Active admins" value={summary.activeAdmins} />
            <SummaryTile label="Failed logins" value={summary.failedLogins} accent="danger" />
            <SummaryTile label="Pending invites" value={summary.pendingInvites} />
            <SummaryTile label="Suspicious" value={summary.suspiciousActivity} accent="danger" />
            <SummaryTile label="Active shops" value={summary.activeShops} accent="neon" />
          </View>
        </ProfileCard>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search user, action, role, or detail"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {TIME_FILTERS.map((chip) => (
          <FilterChip
            key={chip.key}
            label={chip.label}
            active={timeFilter === chip.key}
            onPress={() => setTimeFilter(chip.key)}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CATEGORY_FILTERS.map((chip) => (
          <FilterChip
            key={chip.key}
            label={chip.label}
            active={categoryFilter === chip.key}
            onPress={() => setCategoryFilter(chip.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.exportRow}>
        <GlowButton label="Export audit log" variant="outline" onPress={() => void handleExport()} disabled={loading} />
        <Text style={styles.exportHint}>Share filtered events as a secure audit report</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      ) : (
        <>
          <Text style={styles.feedCount}>{filtered.length} audit events</Text>
          <View style={styles.feed}>
            {filtered.map((event) => (
              <AuditEventCard key={event.id} event={event} />
            ))}
          </View>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No events match your filters. Try another time range or category.</Text>
          ) : null}
        </>
      )}

      <GlowButton label="Refresh audit feed" variant="outline" onPress={load} disabled={loading} />
    </ProfileScreenLayout>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.filterChipPressed,
      ]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderColor: "rgba(245,200,66,0.32)",
    backgroundColor: "rgba(255,255,255,0.03)",
    ...theme.shadow.glowGold,
  },
  glass: { borderWidth: 1 },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryTile: {
    minWidth: "30%",
    flexGrow: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  summaryValue: { color: theme.colors.gold, fontSize: 20, fontWeight: "800" },
  summaryValueDanger: { color: theme.colors.danger, fontSize: 20, fontWeight: "800" },
  summaryValueNeon: { color: theme.colors.neon, fontSize: 20, fontWeight: "800" },
  summaryLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 2 },
  searchInput: {
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 10,
  },
  filterRow: { gap: 8, paddingVertical: 2, marginBottom: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  filterChipActive: {
    borderColor: "rgba(245,200,66,0.75)",
    backgroundColor: "rgba(245,200,66,0.12)",
  },
  filterChipPressed: { opacity: 0.88 },
  filterChipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: theme.colors.gold, fontWeight: "800" },
  exportRow: { gap: 6, marginBottom: 12 },
  exportHint: { color: theme.colors.textMuted, fontSize: 11, textAlign: "center" },
  loader: { marginVertical: 24 },
  feedCount: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  feed: { gap: 10, marginBottom: 12 },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
});
