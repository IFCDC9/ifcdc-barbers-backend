import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";
import {
  bookingStatusLabel,
  bookingStatusTone,
  type BookingStatusTone,
} from "../utils/bookingDisplay";

type Props = {
  paymentStatus?: string;
  bookingStatus?: string;
  compact?: boolean;
};

function toneStyles(tone: BookingStatusTone) {
  if (tone === "paid") {
    return { pill: styles.paid, text: styles.paidText, dot: styles.paidDot };
  }
  if (tone === "cancelled") {
    return { pill: styles.cancelled, text: styles.cancelledText, dot: styles.cancelledDot };
  }
  if (tone === "pending") {
    return { pill: styles.pending, text: styles.pendingText, dot: styles.pendingDot };
  }
  if (tone === "active") {
    return { pill: styles.active, text: styles.activeText, dot: styles.activeDot };
  }
  if (tone === "noshow") {
    return { pill: styles.noshow, text: styles.noshowText, dot: styles.noshowDot };
  }
  if (tone === "rescheduled") {
    return { pill: styles.rescheduled, text: styles.rescheduledText, dot: styles.rescheduledDot };
  }
  return { pill: styles.neutral, text: styles.neutralText, dot: styles.neutralDot };
}

export default function BookingStatusBadge({ paymentStatus, bookingStatus, compact }: Props) {
  const tone = bookingStatusTone(paymentStatus, bookingStatus);
  const stylesForTone = toneStyles(tone);
  const label = bookingStatusLabel(paymentStatus, bookingStatus);

  return (
    <View style={[styles.pill, stylesForTone.pill, compact && styles.compact]}>
      <View style={[styles.dot, stylesForTone.dot]} />
      <Text style={[styles.text, stylesForTone.text]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  compact: { paddingHorizontal: 8, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  paid: {
    backgroundColor: "rgba(52,211,153,0.12)",
    borderColor: "rgba(52,211,153,0.45)",
  },
  paidText: { color: "#6ee7b7" },
  paidDot: { backgroundColor: "#34d399" },
  pending: {
    backgroundColor: "rgba(245,158,11,0.12)",
    borderColor: "rgba(245,158,11,0.4)",
  },
  pendingText: { color: "#fbbf24" },
  pendingDot: { backgroundColor: theme.colors.gold },
  cancelled: {
    backgroundColor: "rgba(248,113,113,0.1)",
    borderColor: "rgba(248,113,113,0.4)",
  },
  cancelledText: { color: "#fca5a5" },
  cancelledDot: { backgroundColor: "#f87171" },
  neutral: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  neutralText: { color: theme.colors.textMuted },
  neutralDot: { backgroundColor: "rgba(255,255,255,0.35)" },
  active: {
    backgroundColor: "rgba(96,165,250,0.14)",
    borderColor: "rgba(96,165,250,0.45)",
  },
  activeText: { color: "#93c5fd" },
  activeDot: { backgroundColor: "#60a5fa" },
  noshow: {
    backgroundColor: "rgba(251,146,60,0.14)",
    borderColor: "rgba(251,146,60,0.45)",
  },
  noshowText: { color: "#fdba74" },
  noshowDot: { backgroundColor: "#fb923c" },
  rescheduled: {
    backgroundColor: "rgba(167,139,250,0.14)",
    borderColor: "rgba(167,139,250,0.45)",
  },
  rescheduledText: { color: "#c4b5fd" },
  rescheduledDot: { backgroundColor: "#a78bfa" },
});
