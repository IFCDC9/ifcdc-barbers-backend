import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { palette, radius, shadow } from "../constants/theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Adds a soft gold glow under the card. Use sparingly — overusing the glow
   * across many cards on the same screen flattens the visual hierarchy.
   */
  glow?: boolean;
  /**
   * Visual variant.
   *  - "glass" (default): translucent dark surface with thin gold border + top highlight.
   *  - "solid": opaque deep-black card without highlight (used inside dense lists).
   *  - "outline": transparent card with gold border only (banner-style).
   */
  variant?: "glass" | "solid" | "outline";
};

export default function CardContainer({
  children,
  style,
  glow = false,
  variant = "glass",
}: Props) {
  const variantStyle =
    variant === "solid"
      ? styles.solid
      : variant === "outline"
        ? styles.outline
        : styles.glass;
  return (
    <View style={[styles.card, variantStyle, glow && styles.glow, style]}>
      {variant === "glass" ? <View pointerEvents="none" style={styles.topHighlight} /> : null}
      {variant === "glass" ? <View pointerEvents="none" style={styles.bottomShadow} /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 18,
    overflow: "hidden",
    ...shadow.soft,
  },
  glass: {
    backgroundColor: palette.surface,
    borderWidth: 1,
    borderColor: palette.borderGold,
  },
  solid: {
    backgroundColor: palette.bg2,
    borderWidth: 1,
    borderColor: palette.hairline,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: palette.borderGoldStrong,
  },
  glow: {
    ...shadow.glowGoldSoft,
  },
  topHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  bottomShadow: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
});
