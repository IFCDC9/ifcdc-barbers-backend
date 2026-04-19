import React, { useMemo, useRef } from "react";
import { Animated, Pressable, StyleProp, StyleSheet, Text, TextStyle, ViewStyle } from "react-native";
import { theme } from "../constants/theme";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: "primary" | "outline";
};

export default function GlowButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  variant = "primary",
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const baseStyle = useMemo(() => {
    return variant === "outline" ? styles.outline : styles.primary;
  }, [variant]);

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }], width: "100%" }}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={({ pressed }) => [
          styles.btn,
          baseStyle,
          pressed && !isDisabled && styles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
        android_ripple={{ color: "rgba(245,200,66,0.25)" }}
      >
        <Text style={[styles.text, variant === "outline" && styles.textOutline, textStyle]}>
          {loading ? "…" : label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: theme.colors.gold,
    ...theme.shadow.glowGold,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  text: {
    color: "#111",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  textOutline: {
    color: theme.colors.gold,
  },
  pressed: { opacity: 0.92 },
  disabled: { opacity: 0.45 },
});

