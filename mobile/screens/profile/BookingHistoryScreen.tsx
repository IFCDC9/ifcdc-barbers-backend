import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import { ScreenEmpty, ScreenError, ScreenLoading } from "../../components/LoadingState";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import { fetchMyBookings, type BookingRow } from "../../services/profileApi";
import {
  formatBookingDateTime,
  formatMoney,
} from "../../utils/bookingDisplay";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { UX } from "../../utils/uxCopy";
import { theme } from "../../constants/theme";

function BookingCard({ row, onPress }: { row: BookingRow; onPress: () => void }) {
  const when = formatBookingDateTime(row.date, row.time, row.created_at);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open ${row.service || "appointment"} on ${when}`}
    >
      <ProfileCard style={styles.bookingCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.bookingService} numberOfLines={1}>
            {row.service || "Appointment"}
          </Text>
          <BookingStatusBadge
            paymentStatus={row.payment_status}
            bookingStatus={row.booking_status}
            compact
          />
        </View>
        <Text style={styles.bookingMeta} numberOfLines={2}>
          {row.barber_name || "Barber"} · {when}
        </Text>
        <View style={styles.bookingFooter}>
          <Text style={styles.bookingTotal}>{formatMoney(row.total_amount)}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </ProfileCard>
    </Pressable>
  );
}

export default function BookingHistoryScreen({ standalone = false }: { standalone?: boolean }) {
  const navigation = useNavigation<{ navigate: (route: string, params?: unknown) => void }>();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchMyBookings());
    } catch (e) {
      setError(userFacingApiError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProfileScreenLayout
      title={standalone ? "Appointments" : "Booking History"}
      subtitle="Your appointments"
      standalone={standalone}
    >
      {loading ? <ScreenLoading /> : null}
      {error ? <ScreenError message={error} /> : null}
      {!loading && !error && rows.length === 0 ? (
        <ScreenEmpty message={UX.emptyAppointments} />
      ) : null}
      <View style={styles.list}>
        {rows.map((row) => (
          <BookingCard
            key={String(row.id)}
            row={row}
            onPress={() => navigation.navigate("BookingDetail", { bookingId: String(row.id) })}
          />
        ))}
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  cardPressed: { opacity: 0.88 },
  bookingCard: { gap: 6 },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  bookingService: { color: theme.colors.text, fontSize: 17, fontWeight: "700", flex: 1 },
  bookingMeta: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  bookingFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  bookingTotal: { color: theme.colors.gold, fontWeight: "800", fontSize: 16 },
  chevron: { color: theme.colors.gold, fontSize: 22, fontWeight: "300" },
});
