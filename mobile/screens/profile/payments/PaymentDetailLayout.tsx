import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../../components/ProfileScreenLayout";
import ProfileCard from "../../../components/ProfileCard";
import PaymentStatusPill from "../../../components/payments/PaymentStatusPill";
import { PaymentConfigBlock } from "../../../components/payments/PaymentDetailParts";
import type { PaymentProviderConfig } from "../../../services/paymentPlatformModel";
import { UX } from "../../../utils/uxCopy";
import { theme } from "../../../constants/theme";

type Props = {
  provider: PaymentProviderConfig;
  children: React.ReactNode;
};

export default function PaymentDetailLayout({ provider, children }: Props) {
  return (
    <ProfileScreenLayout
      title={provider.name}
      subtitle={UX.paymentInfrastructure}
      headerTopPad={12}
    >
      <ProfileCard style={styles.hero}>
        <Text style={styles.heroIcon}>{provider.icon}</Text>
        <Text style={styles.heroTitle}>{provider.headline}</Text>
        <PaymentStatusPill status={provider.payment_status} />
        <View style={styles.metaRow}>
          <MetaChip label={provider.supports_deposit ? "Deposits on" : "Deposits off"} />
          <MetaChip label={provider.supports_platform_fee ? "Platform fee on" : "Platform fee off"} />
          <MetaChip label={provider.supports_mobile_wallet ? "Wallet" : "No wallet"} />
        </View>
      </ProfileCard>

      <ProfileCard style={styles.analytics}>
        <Text style={styles.analyticsTitle}>Payment activity</Text>
        <PaymentConfigBlock label="Volume and settlement metrics" />
      </ProfileCard>

      <View style={styles.body}>{children}</View>
    </ProfileScreenLayout>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 20,
    borderColor: "rgba(245,200,66,0.3)",
    backgroundColor: "rgba(255,255,255,0.03)",
    ...theme.shadow.glowGold,
  },
  heroIcon: { fontSize: 36 },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 4,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  chipText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  analytics: { gap: 8, paddingVertical: 12 },
  analyticsTitle: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  body: { gap: 12, marginTop: 4 },
});
