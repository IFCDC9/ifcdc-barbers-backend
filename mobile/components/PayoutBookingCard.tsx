import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import BookingStatusBadge from "./BookingStatusBadge";
import {
  displayCustomerEmail,
  displayCustomerName,
  formatBookingDateTime,
} from "../utils/bookingDisplay";
import type { PayoutBooking } from "../services/payoutFinanceApi";
import { theme } from "../constants/theme";

type Props = {
  booking: PayoutBooking;
  amountLabel: string;
  amountValue: string;
  onPress: () => void;
  onMarkInPerson?: () => void;
  onResend?: () => void;
  showInPersonActions?: boolean;
  busy?: boolean;
};

export default function PayoutBookingCard({
  booking,
  amountLabel,
  amountValue,
  onPress,
  onMarkInPerson,
  onResend,
  showInPersonActions,
  busy,
}: Props) {
  const when = formatBookingDateTime(booking.date, booking.time, booking.created_at);
  const customer = displayCustomerName(booking.customer_name, booking.customer_email);
  const email = displayCustomerEmail(booking.customer_email);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]} accessibilityRole="button">
      <ProfileCard style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.service} numberOfLines={1}>
            {booking.service || "Appointment"}
          </Text>
          <BookingStatusBadge paymentStatus={booking.payment_status} bookingStatus={booking.booking_status} compact />
        </View>
        <Text style={styles.meta}>{customer} · {email}</Text>
        <Text style={styles.meta}>{booking.barber_name || "Barber"} · {when}</Text>
        {booking.paypal_capture_id ? (
          <Text style={styles.capture} numberOfLines={1}>
            PayPal · {booking.paypal_capture_id}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <View>
            <Text style={styles.amountLabel}>{amountLabel}</Text>
            <Text style={styles.amount}>{amountValue}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
        {showInPersonActions ? (
          <View style={styles.actions}>
            {onMarkInPerson ? (
              <Pressable onPress={onMarkInPerson} disabled={busy} style={styles.actionBtn}>
                <Text style={styles.actionText}>Mark received</Text>
              </Pressable>
            ) : null}
            {onResend ? (
              <Pressable onPress={onResend} disabled={busy} style={styles.actionBtn}>
                <Text style={styles.actionText}>Resend receipt</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </ProfileCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88 },
  card: { gap: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  service: { color: theme.colors.text, fontSize: 16, fontWeight: "700", flex: 1 },
  meta: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  capture: { color: theme.colors.textMuted, fontSize: 12 },
  footer: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 4 },
  amountLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  amount: { color: theme.colors.gold, fontSize: 17, fontWeight: "800" },
  chevron: { color: theme.colors.gold, fontSize: 22, fontWeight: "300" },
  actions: { flexDirection: "row", gap: 8, marginTop: 6, flexWrap: "wrap" },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.35)",
    backgroundColor: "rgba(245,200,66,0.08)",
  },
  actionText: { color: theme.colors.gold, fontSize: 12, fontWeight: "700" },
});
