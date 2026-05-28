import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { palette, radius, typography } from "../constants/theme";

type Variant = "muted" | "danger" | "gold";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  style?: ViewStyle;
};

/** Compact text action — clear, delete, dismiss (not full-width buttons). */
export default function TextChip({ label, onPress, variant = "muted", style }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, speed: 40 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40 }).start();
        }}
        style={({ pressed }) => [
          styles.base,
          variant === "danger" && styles.danger,
          variant === "gold" && styles.gold,
          variant === "muted" && styles.muted,
          pressed && styles.pressed,
          style,
        ]}
        accessibilityRole="button"
      >
        <Text
          style={[
            styles.label,
            variant === "danger" && styles.dangerLabel,
            variant === "gold" && styles.goldLabel,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  muted: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: palette.hairline,
  },
  gold: {
    backgroundColor: palette.goldBg,
    borderColor: palette.borderGold,
  },
  danger: {
    backgroundColor: palette.dangerBg,
    borderColor: "rgba(255,107,107,0.35)",
  },
  pressed: { opacity: 0.85 },
  label: { ...typography.micro, color: palette.textMuted, textTransform: "none", letterSpacing: 0.2 },
  goldLabel: { color: palette.gold },
  dangerLabel: { color: palette.danger, fontWeight: "800" },
});
