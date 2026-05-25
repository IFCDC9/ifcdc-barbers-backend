import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import PaymentProviderCard from "../../components/payments/PaymentProviderCard";
import { PAYMENT_PROVIDERS } from "../../services/paymentPlatformModel";
import type { ProfileStackParamList } from "../../navigation/ProfileStack";
import { PAYMENT_DETAIL_ROUTE } from "../../navigation/paymentStackTypes";
import type { PaymentProviderId } from "../../services/paymentPlatformModel";
import { UX } from "../../utils/uxCopy";
import { theme } from "../../constants/theme";

type Nav = StackNavigationProp<ProfileStackParamList, "PaymentMethods">;

function detailRouteFor(providerId: PaymentProviderId): keyof ProfileStackParamList {
  return PAYMENT_DETAIL_ROUTE[providerId];
}

export default function PaymentMethodsScreen() {
  const navigation = useNavigation<Nav>();

  const activeCount = PAYMENT_PROVIDERS.filter((p) => p.payment_status === "active").length;

  const openProvider = (providerId: PaymentProviderId) => {
    const route = detailRouteFor(providerId);
    navigation.navigate(route);
  };

  return (
    <ProfileScreenLayout
      title="Payment Methods"
      subtitle={UX.paymentInfrastructure}
      headerTopPad={12}
    >
      <ProfileCard style={styles.hero}>
        <Text style={styles.heroEyebrow}>IFCDC Payments</Text>
        <Text style={styles.heroTitle}>Payment infrastructure</Text>
        <Text style={styles.heroCopy}>
          Manage checkout methods, platform fees, and wallet readiness across IFCDC.
          Customer checkout continues through secure PayPal — card data never touches this app.
        </Text>
        <View style={styles.statsRow}>
          <Stat label="Active methods" value={String(activeCount)} />
          <Stat label="Providers" value={String(PAYMENT_PROVIDERS.length)} />
          <Stat label="Platform fee" value="$0.99" />
        </View>
      </ProfileCard>

      <Text style={styles.sectionLabel}>Payment providers</Text>
      <View style={styles.list}>
        {PAYMENT_PROVIDERS.map((provider) => (
          <PaymentProviderCard
            key={provider.id}
            provider={provider}
            onPress={() => openProvider(provider.id)}
          />
        ))}
      </View>
    </ProfileScreenLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: 8,
    paddingVertical: 18,
    borderColor: "rgba(245,200,66,0.32)",
    backgroundColor: "rgba(255,255,255,0.03)",
    ...theme.shadow.glowGold,
  },
  heroEyebrow: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  heroCopy: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  stat: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    gap: 2,
  },
  statValue: { color: theme.colors.gold, fontSize: 16, fontWeight: "800" },
  statLabel: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    textAlign: "center",
  },
  sectionLabel: {
    color: theme.colors.gold,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginTop: 6,
    marginBottom: 2,
  },
  list: { gap: 12 },
});
