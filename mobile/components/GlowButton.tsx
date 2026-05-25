import React, { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { palette, radius, shadow, typography } from "../constants/theme";

type Variant = "primary" | "outline" | "secondary" | "danger";

type Props = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  variant?: Variant;
  /** Optional small icon element rendered to the left of the label. */
  iconLeft?: React.ReactNode;
  /** Optional small icon element rendered to the right of the label. */
  iconRight?: React.ReactNode;
};

export default function GlowButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  style,
  textStyle,
  variant = "primary",
  iconLeft,
  iconRight,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  const variantStyles = useMemo(() => stylesByVariant(variant), [variant]);

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 30,
      bounciness: 6,
    }).start();
  };

  const labelColor =
    variant === "primary"
      ? "#101010"
      : variant === "danger"
        ? "#fff"
        : palette.gold;

  return (
    <Animated.View style={{ transform: [{ scale }], width: "100%" }}>
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        onPressIn={pressIn}
        onPressOut={pressOut}
        style={({ pressed }) => [
          styles.btn,
          variantStyles.base,
          pressed && !isDisabled && variantStyles.pressed,
          isDisabled && styles.disabled,
          style,
        ]}
        android_ripple={{
          color:
            variant === "primary"
              ? "rgba(0,0,0,0.18)"
              : "rgba(245,200,66,0.20)",
          borderless: false,
        }}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
      >
        {variant === "primary" ? (
          <View pointerEvents="none" style={styles.primaryHighlight} />
        ) : null}
        <View style={styles.row}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === "primary" ? "#101010" : palette.gold}
              style={styles.spinner}
            />
          ) : (
            iconLeft && <View style={styles.iconWrap}>{iconLeft}</View>
          )}
          <Text
            style={[
              typography.buttonLabel,
              { color: labelColor },
              textStyle,
            ]}
            numberOfLines={1}
          >
            {loading ? "Working…" : label}
          </Text>
          {!loading && iconRight ? <View style={styles.iconWrap}>{iconRight}</View> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function stylesByVariant(variant: Variant) {
  switch (variant) {
    case "outline":
      return {
        base: styles.outline,
        pressed: styles.outlinePressed,
      };
    case "secondary":
      return {
        base: styles.secondary,
        pressed: styles.secondaryPressed,
      };
    case "danger":
      return {
        base: styles.danger,
        pressed: styles.dangerPressed,
      };
    case "primary":
    default:
      return {
        base: styles.primary,
        pressed: styles.primaryPressed,
      };
  }
}

const styles = StyleSheet.create({
  btn: {
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconWrap: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  spinner: { marginRight: 4 },

  primary: {
    backgroundColor: palette.gold,
    borderWidth: 1,
    borderColor: palette.goldHigh,
    ...shadow.glowGold,
  },
  primaryPressed: {
    backgroundColor: palette.goldDeep,
    transform: [{ translateY: 1 }],
  },
  /** Faux-gradient: a thin bright stripe on top of the gold fill */
  primaryHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: "55%",
    backgroundColor: "rgba(255,255,255,0.18)",
  },

  outline: {
    backgroundColor: "rgba(245,200,66,0.06)",
    borderWidth: 1,
    borderColor: palette.borderGoldStrong,
  },
  outlinePressed: {
    backgroundColor: "rgba(245,200,66,0.14)",
  },

  secondary: {
    backgroundColor: palette.bg2,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  secondaryPressed: {
    backgroundColor: "#181818",
  },

  danger: {
    backgroundColor: palette.danger,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    ...shadow.glowDanger,
  },
  dangerPressed: {
    backgroundColor: "#e35454",
    transform: [{ translateY: 1 }],
  },

  disabled: { opacity: 0.45 },
});
