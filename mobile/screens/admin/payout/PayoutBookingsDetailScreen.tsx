import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenLoading } from "../../../components/LoadingState";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../../components/ProfileScreenLayout";
import ProfileCard from "../../../components/ProfileCard";
import GlowButton from "../../../components/GlowButton";
import PayoutBookingCard from "../../../components/PayoutBookingCard";
import FinanceRouteGuard from "../../../components/FinanceRouteGuard";
import {
  exportPayoutReport,
  fetchPayoutBookings,
  filterBookingsByCategory,
  filterBookingsByPaymentFilter,
  markInPersonPaymentReceived,
  PAYOUT_CATEGORY_COPY,
  payoutRowAmount,
  payoutRowAmountNumber,
  resendBookingConfirmation,
  type PayoutCategory,
  type PayoutPaymentFilter,
} from "../../../services/payoutFinanceApi";
import { formatMoney } from "../../../utils/bookingDisplay";
import { userFacingApiError } from "../../../utils/userFacingApiError";
import { UX } from "../../../utils/uxCopy";
import { theme } from "../../../constants/theme";
import type { AdminStackParamList } from "../../../navigation/AdminStack";

type Nav = StackNavigationProp<AdminStackParamList>;

const FILTERS: { key: PayoutPaymentFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "in_person", label: "In-person" },
];

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function PayoutBookingsDetailInner({ category }: { category: PayoutCategory }) {
  const navigation = useNavigation<Nav>();
  const copy = PAYOUT_CATEGORY_COPY[category];
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PayoutPaymentFilter>("all");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof fetchPayoutBookings>>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchPayoutBookings());
    } catch (e) {
      Alert.alert(copy.title, userFacingApiError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [copy.title]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const filtered = useMemo(() => {
    const categoryRows = filterBookingsByCategory(rows, category);
    return filterBookingsByPaymentFilter(categoryRows, filter);
  }, [rows, category, filter]);

  const total = useMemo(
    () => filtered.reduce((sum, b) => sum + payoutRowAmountNumber(b, category), 0),
    [filtered, category],
  );

  const onMarkInPerson = (bookingId: string) => {
    Alert.alert("Mark payment received", "Record in-person payment for this booking?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setBusyId(bookingId);
          try {
            const message = await markInPersonPaymentReceived(bookingId);
            Alert.alert("Payment recorded", message);
            void load();
          } catch (e) {
            Alert.alert("Payment", userFacingApiError(e));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const onResend = async (bookingId: string) => {
    setBusyId(bookingId);
    try {
      const message = await resendBookingConfirmation(bookingId);
      Alert.alert("Receipt", message);
    } catch (e) {
      Alert.alert("Receipt", userFacingApiError(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProfileScreenLayout title={copy.title} subtitle={copy.subtitle} headerTopPad={12}>
      <ProfileCard style={styles.summary}>
        <Text style={styles.summaryLabel}>{filtered.length} bookings</Text>
        <Text style={styles.summaryValue}>{formatMoney(total)}</Text>
      </ProfileCard>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((chip) => (
          <FilterChip
            key={chip.key}
            label={chip.label}
            active={filter === chip.key}
            onPress={() => setFilter(chip.key)}
          />
        ))}
      </ScrollView>

      <View style={styles.toolbar}>
        <GlowButton label="Refresh totals" variant="outline" onPress={load} disabled={loading} />
        <GlowButton
          label="Export report"
          variant="outline"
          onPress={() => void exportPayoutReport(category, filtered).catch(() => {
            Alert.alert("Export", UX.shareUnavailable);
          })}
          disabled={loading || filtered.length === 0}
        />
      </View>

      {loading ? <ScreenLoading /> : null}

      {!loading && filtered.length === 0 ? (
        <ProfileCard>
          <Text style={styles.empty}>No bookings match this filter.</Text>
        </ProfileCard>
      ) : null}

      <View style={styles.list}>
        {filtered.map((booking) => (
          <PayoutBookingCard
            key={String(booking.id)}
            booking={booking}
            amountLabel={copy.amountLabel}
            amountValue={payoutRowAmount(booking, category)}
            onPress={() => navigation.navigate("AdminBookingDetail", { bookingId: String(booking.id) })}
            showInPersonActions={category === "pending_in_person" || category === "booking_summary"}
            onMarkInPerson={
              category === "pending_in_person" || category === "booking_summary"
                ? () => onMarkInPerson(String(booking.id))
                : undefined
            }
            onResend={() => void onResend(String(booking.id))}
            busy={busyId === String(booking.id)}
          />
        ))}
      </View>
    </ProfileScreenLayout>
  );
}

export default function PayoutBookingsDetailScreen({ category }: { category: PayoutCategory }) {
  return (
    <FinanceRouteGuard>
      <PayoutBookingsDetailInner category={category} />
    </FinanceRouteGuard>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: theme.colors.textMuted, fontSize: 14 },
  summaryValue: { color: theme.colors.gold, fontSize: 22, fontWeight: "800" },
  filterRow: { gap: 8, paddingVertical: 10 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipActive: {
    borderColor: "rgba(245,200,66,0.45)",
    backgroundColor: "rgba(245,200,66,0.12)",
  },
  chipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: theme.colors.gold },
  toolbar: { flexDirection: "row", gap: 10, marginBottom: 8 },
  loader: { marginTop: 24 },
  empty: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center", paddingVertical: 8 },
  list: { gap: 10 },
});
