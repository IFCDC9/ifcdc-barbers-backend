import React from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { palette, typography } from "../constants/theme";

export const APP_FOOTER_COPY = {
  copyright: "© 2026 IFCDC • All Rights Reserved",
  powered: "Powered by IFCDC Productions",
} as const;

type Props = {
  /** Show the optional “Powered by IFCDC Productions” line. Default true. */
  showPowered?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Global IFCDC footer — single source of truth for app-wide branding.
 * UI only; place at the bottom of scroll content (above tab-bar safe padding).
 */
export default function AppFooter({ showPowered = true, style }: Props) {
  return (
    <View style={[styles.wrap, style]} accessibilityRole="text">
      <Text style={styles.copyright}>{APP_FOOTER_COPY.copyright}</Text>
      {showPowered ? <Text style={styles.powered}>{APP_FOOTER_COPY.powered}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 20,
    paddingBottom: 4,
    paddingHorizontal: 16,
    gap: 4,
  },
  copyright: {
    ...typography.micro,
    fontSize: 10,
    letterSpacing: 0.35,
    textTransform: "none",
    color: palette.textDim,
    textAlign: "center",
    lineHeight: 14,
  },
  powered: {
    ...typography.micro,
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: "none",
    color: palette.muted,
    textAlign: "center",
    lineHeight: 13,
    opacity: 0.85,
  },
});
