import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenLoading, ScreenError } from "../../components/LoadingState";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import FinanceRouteGuard from "../../components/FinanceRouteGuard";
import { fetchAdminStats, type AdminStats } from "../../services/adminApi";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { theme } from "../../constants/theme";
import type { AdminStackParamList } from "../../navigation/AdminStack";

type Nav = StackNavigationProp<AdminStackParamList, "AdminPayout">;

function money(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function StatRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]} accessibilityRole="button">
      <ProfileCard style={styles.stat}>
        <View style={styles.statCopy}>
          <Text style={styles.statLabel}>{label}</Text>
          <Text style={styles.statValue}>{value}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </ProfileCard>
    </Pressable>
  );
}

function AdminPayoutInner() {
  const navigation = useNavigation<Nav>();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchAdminStats());
    } catch (e) {
      setError(userFacingApiError(e));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProfileScreenLayout title="Payout overview" subtitle="Collections and outstanding balances">
      <GlowButton label="Refresh totals" variant="outline" onPress={load} disabled={loading} />
      {loading ? <ScreenLoading /> : null}
      {error ? <ScreenError message={error} /> : null}
      {stats ? (
        <View style={styles.list}>
          <StatRow
            label="Platform fees collected"
            value={money(stats.platformFeesCollected)}
            onPress={() => navigation.navigate("PlatformFeeDetail")}
          />
          <StatRow
            label="Total collected"
            value={money(stats.totalRevenuePlatform)}
            onPress={() => navigation.navigate("TotalCollectedDetail")}
          />
          <StatRow
            label="Outstanding balance"
            value={money(stats.outstandingBalanceAmount)}
            onPress={() => navigation.navigate("OutstandingBalanceDetail")}
          />
          <StatRow
            label="Pending in-person"
            value={money(stats.pendingPaymentsAmount)}
            onPress={() => navigation.navigate("PendingInPersonDetail")}
          />
          <Pressable
            onPress={() => navigation.navigate("PayoutBookingSummary")}
            style={({ pressed }) => [pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <ProfileCard style={styles.summaryCard}>
              <View style={styles.statCopy}>
                <Text style={styles.summaryTitle}>Booking balance summary</Text>
                <Text style={styles.note}>
                  {stats.outstandingBalanceCount ?? 0} bookings with balance ·{" "}
                  {stats.pendingPaymentsCount ?? 0} pay-in-person pending
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </ProfileCard>
          </Pressable>
        </View>
      ) : null}
    </ProfileScreenLayout>
  );
}

export default function AdminPayoutScreen() {
  return (
    <FinanceRouteGuard>
      <AdminPayoutInner />
    </FinanceRouteGuard>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, marginTop: 8 },
  pressed: { opacity: 0.88 },
  stat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 },
  statCopy: { flex: 1, gap: 4 },
  statLabel: { color: theme.colors.textMuted, fontSize: 14 },
  statValue: { color: theme.colors.gold, fontSize: 18, fontWeight: "800" },
  summaryCard: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  summaryTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  note: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
  chevron: { color: theme.colors.gold, fontSize: 22, fontWeight: "300" },
  error: { color: "#f87171", marginTop: 16 },
});
