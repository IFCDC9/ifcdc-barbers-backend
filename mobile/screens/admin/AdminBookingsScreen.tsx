import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ScreenLoading, ScreenEmpty, ScreenError } from "../../components/LoadingState";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import { fetchAdminBookings, type BookingRow } from "../../services/profileApi";
import { userFacingApiError } from "../../utils/userFacingApiError";
import {
  displayCustomerEmail,
  displayCustomerName,
  formatBookingDateTime,
  formatMoney,
} from "../../utils/bookingDisplay";
import { theme } from "../../constants/theme";
import type { AdminStackParamList } from "../../navigation/AdminStack";

type BookingsRoute = RouteProp<AdminStackParamList, "AdminBookings">;
type Nav = StackNavigationProp<AdminStackParamList, "AdminBookings">;

function BookingCard({
  row,
  onPress,
}: {
  row: BookingRow;
  onPress: () => void;
}) {
  const when = formatBookingDateTime(row.date, row.time, row.created_at);
  const customerLine = `${displayCustomerName(row.customer_name, row.customer_email)} · ${displayCustomerEmail(row.customer_email)}`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Open booking for ${row.service || "appointment"}`}
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
        <Text style={styles.bookingMeta} numberOfLines={1}>
          {row.barber_name || "Barber"} · {when}
        </Text>
        <Text style={styles.bookingMeta} numberOfLines={1}>
          {customerLine}
        </Text>
        <View style={styles.bookingFooter}>
          <Text style={styles.bookingTotal}>{formatMoney(row.total_amount)}</Text>
          <Text style={styles.chevron}>›</Text>
        </View>
      </ProfileCard>
    </Pressable>
  );
}

export default function AdminBookingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<BookingsRoute>();
  const filterBarberId = route.params?.barberId;
  const filterBarberName = route.params?.barberName;
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchAdminBookings());
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

  const filtered = useMemo(() => {
    if (!filterBarberId && !filterBarberName) return rows;
    return rows.filter((b) => {
      if (filterBarberId && String(b.barber_id || "") === String(filterBarberId)) return true;
      if (filterBarberName && String(b.barber_name || "").toLowerCase() === filterBarberName.toLowerCase()) {
        return true;
      }
      return false;
    });
  }, [rows, filterBarberId, filterBarberName]);

  const subtitle = filterBarberName
    ? `Bookings for ${filterBarberName}`
    : "Platform-wide booking management";

  return (
    <ProfileScreenLayout title="Bookings" subtitle={subtitle}>
      {loading ? <ScreenLoading /> : null}
      {error ? <ScreenError message={error} /> : null}
      {!loading && !error && filtered.length === 0 ? <ScreenEmpty message="No bookings found." /> : null}
      <View style={styles.list}>
        {filtered.map((row) => (
          <BookingCard
            key={String(row.id)}
            row={row}
            onPress={() =>
              navigation.navigate("AdminBookingDetail", { bookingId: String(row.id) })
            }
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
  bookingMeta: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 19 },
  bookingFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  bookingTotal: { color: theme.colors.gold, fontWeight: "700", fontSize: 16 },
  chevron: { color: theme.colors.gold, fontSize: 22, fontWeight: "300" },
  error: { color: "#f87171", marginTop: 16 },
  empty: { color: theme.colors.textMuted, fontSize: 14 },
});
