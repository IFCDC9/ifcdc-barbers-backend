import React from "react";
import { StyleSheet, View } from "react-native";
import { palette } from "../constants/theme";

/**
 * Cyber-luxury backdrop for Home / Explore / AURA / Booking screens.
 *
 * Five static layers (no animation) compose a black-to-gold ambient feel:
 *   1. Solid black base
 *   2. Subtle top fade to bg1 for atmospheric depth
 *   3. Top gold halo (large, very low opacity)
 *   4. Bottom-right gold halo (smaller, even lower opacity)
 *   5. Bottom fade to true black for contrast against the tab bar
 *
 * Pure RN primitives — no native deps, no perf cost.
 */
export default function DarkGradientBackground() {
  return (
    <View pointerEvents="none" style={styles.layer}>
      <View style={styles.base} />
      <View style={styles.topFade} />
      <View style={styles.topGlow} />
      <View style={styles.rightGlow} />
      <View style={styles.bottomFade} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: palette.bg0,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "45%",
    backgroundColor: palette.bg1,
    opacity: 0.4,
  },
  topGlow: {
    position: "absolute",
    top: -160,
    left: "50%",
    marginLeft: -220,
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: "rgba(245,200,66,0.06)",
  },
  rightGlow: {
    position: "absolute",
    bottom: 80,
    right: -140,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(245,200,66,0.04)",
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "32%",
    backgroundColor: "#020202",
    opacity: 0.65,
  },
});
