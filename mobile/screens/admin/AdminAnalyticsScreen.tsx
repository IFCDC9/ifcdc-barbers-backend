import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { ScreenLoading, ScreenError } from "../../components/LoadingState";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import { fetchAdminStats, type AdminStats } from "../../services/adminApi";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { theme } from "../../constants/theme";

function money(v: unknown) {
  const n = Number(v);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : "—";
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <ProfileCard style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </ProfileCard>
  );
}

export default function AdminAnalyticsScreen() {
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
    <ProfileScreenLayout title="Platform analytics" subtitle="Revenue and booking metrics">
      {loading ? <ScreenLoading /> : null}
      {error ? <ScreenError message={error} /> : null}
      {stats ? (
        <>
          <StatRow label="Total bookings" value={String(stats.allBookingsCount ?? stats.totalBookings ?? 0)} />
          <StatRow label="Paid bookings" value={String(stats.paidBookingsCount ?? 0)} />
          <StatRow label="Confirmed" value={String(stats.confirmedBookingsCount ?? 0)} />
          <StatRow label="Gross revenue" value={money(stats.totalRevenue)} />
          <StatRow label="Average booking" value={money(stats.avgBooking)} />
          <StatRow label="Highest payment" value={money(stats.highestPayment)} />
          {stats.lastPaymentAt ? (
            <ProfileCard>
              <Text style={styles.note}>Last payment: {new Date(stats.lastPaymentAt).toLocaleString()}</Text>
            </ProfileCard>
          ) : null}
        </>
      ) : null}
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  stat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statLabel: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  statValue: { color: theme.colors.gold, fontSize: 16, fontWeight: "800" },
  note: { color: theme.colors.textMuted, fontSize: 13 },
});
