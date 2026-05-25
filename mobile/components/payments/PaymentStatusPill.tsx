import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PAYMENT_STATUS_COPY, type PaymentStatusLabel } from "../../services/paymentPlatformModel";
import { theme } from "../../constants/theme";

type Props = {
  status: PaymentStatusLabel;
  compact?: boolean;
};

export default function PaymentStatusPill({ status, compact }: Props) {
  const copy = PAYMENT_STATUS_COPY[status];
  const toneStyle =
    copy.tone === "active"
      ? styles.active
      : copy.tone === "setup"
        ? styles.setup
        : styles.pending;

  return (
    <View style={[styles.pill, toneStyle, compact && styles.pillCompact]}>
      <View style={[styles.dot, copy.tone === "active" && styles.dotActive]} />
      <Text style={[styles.text, copy.tone === "active" && styles.textActive]}>{copy.label}</Text>
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
  pillCompact: { paddingHorizontal: 8, paddingVertical: 4 },
  active: {
    backgroundColor: "rgba(245,200,66,0.14)",
    borderColor: "rgba(245,200,66,0.45)",
  },
  setup: {
    backgroundColor: "rgba(255,180,80,0.1)",
    borderColor: "rgba(255,180,80,0.35)",
  },
  pending: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.14)",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  dotActive: { backgroundColor: theme.colors.gold },
  text: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  textActive: { color: theme.colors.gold },
});
