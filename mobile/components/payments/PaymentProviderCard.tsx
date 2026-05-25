import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "../ProfileCard";
import PaymentStatusPill from "./PaymentStatusPill";
import type { PaymentProviderConfig } from "../../services/paymentPlatformModel";
import { theme } from "../../constants/theme";

type Props = {
  provider: PaymentProviderConfig;
  onPress: () => void;
};

export default function PaymentProviderCard({ provider, onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 0.982, useNativeDriver: true, speed: 28, bounciness: 4 }),
      Animated.timing(glow, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const pressOut = () => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 28, bounciness: 8 }),
      Animated.timing(glow, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={`Open ${provider.name} payment settings`}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <ProfileCard style={[styles.card, styles.glass]}>
          <Animated.View style={[styles.glowOverlay, { opacity: glowOpacity }]} pointerEvents="none" />
          <View style={styles.row}>
            <View style={styles.iconWrap}>
              <Text style={styles.icon}>{provider.icon}</Text>
            </View>
            <View style={styles.copy}>
              <View style={styles.titleRow}>
                <Text style={styles.name}>{provider.name}</Text>
                <PaymentStatusPill status={provider.payment_status} compact />
              </View>
              <Text style={styles.headline}>{provider.headline}</Text>
              <Text style={styles.description} numberOfLines={2}>
                {provider.description}
              </Text>
              <View style={styles.flags}>
                {provider.supports_deposit ? <Flag label="Deposits" /> : null}
                {provider.supports_platform_fee ? <Flag label="Platform fee" /> : null}
                {provider.supports_mobile_wallet ? <Flag label="Mobile wallet" /> : null}
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </ProfileCard>
      </Animated.View>
    </Pressable>
  );
}

function Flag({ label }: { label: string }) {
  return (
    <View style={styles.flag}>
      <Text style={styles.flagText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  glass: {
    ...theme.shadow.glowGold,
  },
  glowOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245,200,66,0.12)",
    borderRadius: theme.radius.lg,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.25)",
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { fontSize: 22 },
  copy: { flex: 1, gap: 4 },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  name: {
    color: theme.colors.gold,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.2,
    flex: 1,
  },
  headline: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  flag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  flagText: {
    color: theme.colors.textMuted,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  chevron: {
    color: theme.colors.gold,
    fontSize: 24,
    fontWeight: "300",
    marginTop: 8,
  },
});
