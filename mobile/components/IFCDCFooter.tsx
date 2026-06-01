import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { palette, typography } from "../constants/theme";

/** Single source of truth — update footer copy here only. */
export const IFCDC_FOOTER_COPY = {
  copyright: "© 2026 IFCDC",
  powered: "Powered by IFCDC Productions",
} as const;

/** @deprecated Use IFCDC_FOOTER_COPY */
export const APP_FOOTER_COPY = IFCDC_FOOTER_COPY;

type Props = {
  /** Show “Powered by IFCDC Productions”. Default true. */
  showPowered?: boolean;
  /** Tighter spacing for tab-root screens (above bottom nav). */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Global IFCDC footer — branding only.
 * Mounted globally via LazyScreen (tabs) and auth screens.
 */
export default function IFCDCFooter({
  showPowered = true,
  compact = false,
  style,
}: Props) {
  return (
    <View
      style={[styles.wrap, compact && styles.wrapCompact, style]}
      accessibilityRole="text"
      accessibilityLabel={`${IFCDC_FOOTER_COPY.copyright}. ${showPowered ? IFCDC_FOOTER_COPY.powered : ""}`}
    >
      <Text style={styles.copyright}>{IFCDC_FOOTER_COPY.copyright}</Text>
      {showPowered ? <Text style={styles.powered}>{IFCDC_FOOTER_COPY.powered}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 16,
    paddingBottom: 8,
    paddingHorizontal: 20,
    gap: 3,
  },
  wrapCompact: {
    paddingTop: 6,
    paddingBottom: 2,
    gap: 0,
  },
  copyright: {
    ...typography.caption,
    fontSize: 11,
    letterSpacing: 0.3,
    color: palette.muted,
    textAlign: "center",
    lineHeight: 15,
  },
  powered: {
    ...typography.micro,
    fontSize: 10,
    letterSpacing: 0.4,
    textTransform: "none",
    color: palette.textDim,
    textAlign: "center",
    lineHeight: 14,
  },
});
