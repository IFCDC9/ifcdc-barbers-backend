import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ProfileCard from "../ProfileCard";
import { UX } from "../../utils/uxCopy";
import { theme } from "../../constants/theme";

export function PaymentDetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, highlight && styles.valueHighlight]}>{value}</Text>
    </View>
  );
}

export function PaymentDetailSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <ProfileCard style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </ProfileCard>
  );
}

export function PaymentBanner({
  title,
  body,
  tone = "gold",
}: {
  title: string;
  body: string;
  tone?: "gold" | "muted";
}) {
  return (
    <View style={[styles.banner, tone === "muted" && styles.bannerMuted]}>
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerBody}>{body}</Text>
    </View>
  );
}

export function PaymentConfigBlock({ label }: { label: string }) {
  return (
    <View style={styles.configBlock}>
      <Text style={styles.configLabel}>{label}</Text>
      <Text style={styles.configSub}>{UX.sectionReady}</Text>
    </View>
  );
}

/** @deprecated Use PaymentConfigBlock */
export const PaymentPlaceholderBlock = PaymentConfigBlock;

const styles = StyleSheet.create({
  section: { gap: 2, paddingVertical: 6 },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  label: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  value: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: "600",
    maxWidth: "54%",
    textAlign: "right",
  },
  valueHighlight: { color: theme.colors.gold },
  banner: {
    padding: 14,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.35)",
    backgroundColor: "rgba(245,200,66,0.08)",
    gap: 6,
  },
  bannerMuted: {
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bannerTitle: { color: theme.colors.gold, fontSize: 14, fontWeight: "800" },
  bannerBody: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 19 },
  configBlock: {
    padding: 16,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(245,200,66,0.25)",
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  configLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  configSub: { color: theme.colors.textMuted, fontSize: 12, textAlign: "center" },
});
