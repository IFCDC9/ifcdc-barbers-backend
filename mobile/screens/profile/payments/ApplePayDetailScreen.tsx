import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Switch, Text, View } from "react-native";
import ProfileCard from "../../../components/ProfileCard";
import {
  PaymentDetailRow,
  PaymentDetailSection,
  PaymentConfigBlock,
} from "../../../components/payments/PaymentDetailParts";
import { UX } from "../../../utils/uxCopy";
import { getPaymentProvider } from "../../../services/paymentPlatformModel";
import {
  loadApplePayEnabledWhenReady,
  saveApplePayEnabledWhenReady,
} from "../../../services/paymentPlatformPrefs";
import { theme } from "../../../constants/theme";
import PaymentDetailLayout from "./PaymentDetailLayout";

export default function ApplePayDetailScreen() {
  const provider = getPaymentProvider("apple_pay");
  const [enabledWhenReady, setEnabledWhenReady] = useState(false);

  useEffect(() => {
    void loadApplePayEnabledWhenReady().then(setEnabledWhenReady);
  }, []);

  const checklist = [
    { label: "Apple Developer merchant ID", done: false },
    { label: "Payment processing entitlement", done: false },
    { label: "iOS provisioning profile", done: false },
    { label: "Compatible iOS device", done: Platform.OS === "ios" },
  ];

  return (
    <PaymentDetailLayout provider={provider}>
      <PaymentDetailSection title="Provider status">
        <PaymentDetailRow label="Status" value="In setup" highlight />
        <PaymentDetailRow label="Setup progress" value="In progress" highlight />
        <PaymentDetailRow label="Merchant ID" value="In setup" />
        <PaymentDetailRow label="Apple entitlement" value="In setup" />
      </PaymentDetailSection>

      <PaymentDetailSection title="Features">
        <PaymentDetailRow label="Mobile wallet checkout" value="Planned" />
        <PaymentDetailRow label="Deposit support" value="Planned" />
        <PaymentDetailRow label="Platform fee pass-through" value="Planned" />
        <PaymentDetailRow label="Express checkout" value="Planned" />
      </PaymentDetailSection>

      <PaymentDetailSection title="iOS readiness">
        {checklist.map((item) => (
          <PaymentDetailRow
            key={item.label}
            label={item.label}
            value={item.done ? "Ready" : "Required"}
            highlight={item.done}
          />
        ))}
      </PaymentDetailSection>

      <ProfileCard style={styles.toggleCard}>
        <View style={styles.toggleRow}>
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Enable when available</Text>
            <Text style={styles.toggleSub}>
              Saves your preference only — PayPal checkout remains unchanged.
            </Text>
          </View>
          <Switch
            value={enabledWhenReady}
            onValueChange={(v) => {
              setEnabledWhenReady(v);
              void saveApplePayEnabledWhenReady(v);
            }}
            trackColor={{ false: "#333", true: "rgba(245,200,66,0.45)" }}
            thumbColor={enabledWhenReady ? theme.colors.gold : "#888"}
          />
        </View>
      </ProfileCard>

      <PaymentConfigBlock label="Wallet verification" />
    </PaymentDetailLayout>
  );
}

const styles = StyleSheet.create({
  toggleCard: { paddingVertical: 14 },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  toggleCopy: { flex: 1, gap: 4 },
  toggleTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  toggleSub: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
});
