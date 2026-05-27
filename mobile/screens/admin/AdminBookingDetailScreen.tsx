import React, { useCallback, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ScreenLoading } from "../../components/LoadingState";
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import BookingStatusBadge from "../../components/BookingStatusBadge";
import {
  fetchAdminBookingById,
  patchAdminBookingAction,
  resendBookingConfirmation,
  type AdminBookingDetail,
} from "../../services/adminBookingApi";
import { maskPhoneForDisplay } from "../../utils/redactPii";
import {
  displayCustomerEmail,
  displayCustomerName,
  formatBookingDateTime,
  formatCreatedAt,
  formatMoney,
  paymentMethodDisplayLabel,
  paymentStatusHeadline,
} from "../../utils/bookingDisplay";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { theme } from "../../constants/theme";
import type { AdminStackParamList } from "../../navigation/AdminStack";

export type AdminBookingDetailParams = { bookingId: string };

type DetailRoute = RouteProp<AdminStackParamList, "AdminBookingDetail">;

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} selectable>
        {value}
      </Text>
    </View>
  );
}

function paymentSummary(booking: AdminBookingDetail): string {
  const type = String(booking.payment_type || "full").replace(/_/g, " ");
  const deposit = Number(booking.deposit_amount);
  const paid = Number(booking.amount_paid ?? booking.total_paid);
  const remaining = Number(booking.remaining_balance);
  if (type.includes("deposit") && Number.isFinite(deposit) && deposit > 0) {
    const rem = Number.isFinite(remaining) ? ` · Balance ${formatMoney(remaining)}` : "";
    return `Deposit ${formatMoney(deposit)} · Paid ${formatMoney(paid)}${rem}`;
  }
  return `Full payment · ${formatMoney(paid || booking.total_amount || booking.total_price)}`;
}

export default function AdminBookingDetailScreen() {
  const route = useRoute<DetailRoute>();
  const { bookingId } = route.params;

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<AdminBookingDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBooking(await fetchAdminBookingById(bookingId));
    } catch (e) {
      Alert.alert("Booking", userFacingApiError(e));
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const runAction = (
    title: string,
    message: string,
    action: "complete" | "cancel" | "refund",
  ) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: action === "cancel" || action === "refund" ? "destructive" : "default",
        onPress: async () => {
          setBusy(true);
          try {
            const result = await patchAdminBookingAction(bookingId, action);
            if (result.booking) setBooking((prev) => ({ ...(prev || {}), ...result.booking }));
            Alert.alert("Updated", result.message);
            void load();
          } catch (e) {
            Alert.alert("Action failed", userFacingApiError(e));
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const onResend = async () => {
    setBusy(true);
    try {
      const message = await resendBookingConfirmation(bookingId);
      Alert.alert("Confirmation", message);
    } catch (e) {
      Alert.alert("Confirmation", userFacingApiError(e));
    } finally {
      setBusy(false);
    }
  };

  const onContact = () => {
    if (!booking) return;
    const email = displayCustomerEmail(booking.customer_email);
    if (email === "Guest customer" || email === "No email on file") {
      Alert.alert("Contact customer", "No customer email is available for this booking.");
      return;
    }
    const subject = encodeURIComponent(`IFCDC Barbers — appointment ${bookingId.slice(0, 8)}`);
    Linking.openURL(`mailto:${email}?subject=${subject}`).catch(() => {
      Alert.alert("Contact customer", email);
    });
  };

  if (loading) {
    return (
      <ProfileScreenLayout title="Booking detail" subtitle="Admin console">
        <ScreenLoading />
      </ProfileScreenLayout>
    );
  }

  if (!booking) {
    return (
      <ProfileScreenLayout title="Booking detail" subtitle="Admin console">
        <Text style={styles.muted}>Booking not found.</Text>
      </ProfileScreenLayout>
    );
  }

  const customerEmail = displayCustomerEmail(booking.customer_email);
  const appointmentWhen = formatBookingDateTime(booking.date, booking.time, booking.created_at);
  const notes =
    booking.style_title && booking.style_title !== booking.service
      ? `Style: ${booking.style_title}`
      : "—";

  return (
    <ProfileScreenLayout title="Booking detail" subtitle="Admin console" headerTopPad={12}>
      <ProfileCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <Text style={styles.service}>{booking.service || booking.style_title || "Appointment"}</Text>
            <Text style={styles.when}>{appointmentWhen}</Text>
          </View>
          <BookingStatusBadge paymentStatus={booking.payment_status} bookingStatus={booking.booking_status} />
        </View>
        <Text style={styles.total}>{formatMoney(booking.total_amount ?? booking.total_price)}</Text>
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Customer</Text>
        <MetaRow label="Name" value={displayCustomerName(booking.customer_name, booking.customer_email)} />
        <MetaRow label="Email" value={customerEmail} />
        {booking.phone ? (
          <MetaRow label="Phone" value={maskPhoneForDisplay(String(booking.phone))} />
        ) : null}
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Appointment</Text>
        <MetaRow label="Booking ID" value={String(booking.id)} />
        <MetaRow label="Barber" value={booking.barber_name || "—"} />
        <MetaRow label="Service" value={booking.service || booking.style_title || "—"} />
        <MetaRow label="Scheduled" value={appointmentWhen} />
        <MetaRow label="Booking status" value={String(booking.booking_status || "confirmed").replace(/_/g, " ")} />
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Payment</Text>
        <MetaRow
          label="Payment status"
          value={paymentStatusHeadline(
            booking.payment_status,
            booking.remaining_balance,
            booking.amount_paid ?? booking.total_paid,
          )}
        />
        <MetaRow label="Amount paid" value={formatMoney(booking.amount_paid ?? booking.total_paid)} />
        <MetaRow label="Remaining balance" value={formatMoney(booking.remaining_balance)} />
        <MetaRow label="Service price" value={formatMoney(booking.total_price ?? booking.amount)} />
        <MetaRow label="Platform fee" value={formatMoney(booking.platform_fee)} />
        <MetaRow
          label="Method"
          value={paymentMethodDisplayLabel(
            (booking as { payment_method?: string }).payment_method,
            booking.payment_provider,
          )}
        />
        <MetaRow label="Summary" value={paymentSummary(booking)} />
        <MetaRow label="Provider" value={booking.payment_provider || "—"} />
        <MetaRow label="PayPal order" value={booking.paypal_order_id || "—"} />
        <MetaRow
          label="Transaction ID"
          value={
            booking.paypal_capture_id ||
            (booking as { stripe_payment_intent_id?: string }).stripe_payment_intent_id ||
            "—"
          }
        />
      </ProfileCard>

      <ProfileCard style={styles.section}>
        <Text style={styles.sectionTitle}>Notes</Text>
        <MetaRow label="Details" value={notes} />
        <MetaRow label="Created" value={formatCreatedAt(booking.created_at)} />
      </ProfileCard>

      <View style={styles.actions}>
        <GlowButton
          label="Mark complete"
          onPress={() =>
            runAction("Mark complete", "Mark this appointment as completed?", "complete")
          }
          disabled={busy}
        />
        <GlowButton
          label="Resend confirmation"
          variant="outline"
          onPress={() => void onResend()}
          disabled={busy}
          loading={busy}
        />
        <GlowButton label="Contact customer" variant="outline" onPress={onContact} disabled={busy} />
        <GlowButton
          label="Refund booking"
          variant="outline"
          onPress={() =>
            runAction(
              "Refund booking",
              "Record a refund and cancel this booking? PayPal settlement may require provider review.",
              "refund",
            )
          }
          disabled={busy}
        />
        <GlowButton
          label="Cancel booking"
          variant="outline"
          onPress={() =>
            runAction("Cancel booking", "Cancel this appointment? This cannot be undone from the app.", "cancel")
          }
          disabled={busy}
        />
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 32 },
  muted: { color: theme.colors.textMuted, textAlign: "center", marginTop: 24, fontSize: 15 },
  hero: { gap: 10, paddingVertical: 16 },
  heroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  heroCopy: { flex: 1, gap: 4 },
  service: { color: theme.colors.gold, fontSize: 20, fontWeight: "800" },
  when: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  total: { color: theme.colors.text, fontSize: 22, fontWeight: "800" },
  section: { gap: 2 },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  metaLabel: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  metaValue: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    maxWidth: "58%",
    textAlign: "right",
  },
  actions: { gap: 10, marginTop: 4, marginBottom: 8 },
});
