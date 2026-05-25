import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../../components/ProfileScreenLayout";
import ProfileCard from "../../../components/ProfileCard";
import PaymentStatusPill from "../../../components/payments/PaymentStatusPill";
import { PAYMENT_PROVIDERS } from "../../../services/paymentPlatformModel";
import { theme } from "../../../constants/theme";

/** Overview of all rails — optional entry; provider cards use dedicated detail screens. */
export default function PaymentProviderDetailScreen() {
  return (
    <ProfileScreenLayout
      title="Payment infrastructure"
      subtitle="Provider overview"
      headerTopPad={12}
    >
      <ProfileCard style={styles.lead}>
        <Text style={styles.leadText}>
          Each payment rail has its own detail screen with integration state, feature coverage,
          and settlement metrics.
        </Text>
      </ProfileCard>

      <View style={styles.list}>
        {PAYMENT_PROVIDERS.map((p) => (
          <ProfileCard key={p.id} style={styles.row}>
            <View style={styles.rowInner}>
              <Text style={styles.icon}>{p.icon}</Text>
              <View style={styles.copy}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.sub}>{p.headline}</Text>
              </View>
              <PaymentStatusPill status={p.payment_status} compact />
            </View>
          </ProfileCard>
        ))}
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  lead: { paddingVertical: 14 },
  leadText: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 21 },
  list: { gap: 10 },
  row: { paddingVertical: 12, paddingHorizontal: 14 },
  rowInner: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { fontSize: 22, width: 32, textAlign: "center" },
  copy: { flex: 1, gap: 2 },
  name: { color: theme.colors.gold, fontSize: 15, fontWeight: "800" },
  sub: { color: theme.colors.textMuted, fontSize: 12 },
});
