import React from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SHOP_PHONE_DIGITS } from "../constants/config";

function formatUsDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return d || "—";
}

const callUrl = SHOP_PHONE_DIGITS ? `tel:${SHOP_PHONE_DIGITS}` : "";
const smsUrl = SHOP_PHONE_DIGITS ? `sms:${SHOP_PHONE_DIGITS}` : "";

async function openOrAlert(url: string) {
  try {
    const can = await Linking.canOpenURL(url);
    if (!can) {
      Alert.alert("Not available", "Calls and texts open on a physical device or simulator with Phone/Message support.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert("Could not open", "Try again from your phone.");
  }
}

export default function ContactShopCard() {
  if (!SHOP_PHONE_DIGITS) {
    return (
      <View style={styles.card}>
        <Text style={styles.kicker}>DIRECT LINE</Text>
        <Text style={styles.muted}>
          Set EXPO_PUBLIC_SHOP_PHONE_DIGITS (10 digits) or app.json extra.shopPhoneDigits to enable Call / Text.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>DIRECT LINE</Text>
      <Text style={styles.phone}>{formatUsDisplay(SHOP_PHONE_DIGITS)}</Text>

      <View style={styles.row}>
        <Pressable style={styles.btnPrimary} onPress={() => openOrAlert(callUrl)}>
          <Text style={styles.btnText}>Call</Text>
        </Pressable>
        <Pressable style={styles.btnOutline} onPress={() => openOrAlert(smsUrl)}>
          <Text style={styles.btnTextOutline}>Text</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0d0d0d",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(212, 175, 55, 0.28)",
  },
  kicker: {
    color: "rgba(212, 175, 55, 0.75)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 8,
  },
  phone: { color: "#fff", fontSize: 22, fontWeight: "700" },
  muted: { color: "rgba(255,255,255,0.55)", fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", gap: 10, marginTop: 14 },
  btnPrimary: {
    flex: 1,
    backgroundColor: "#f5c842",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  btnOutline: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.6)",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  btnText: { color: "#111", fontWeight: "800" },
  btnTextOutline: { color: "#f5c842", fontWeight: "800" },
});

