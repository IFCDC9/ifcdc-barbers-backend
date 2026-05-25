import React from "react";
import { StyleSheet, View } from "react-native";
import { palette } from "../constants/theme";

/**
 * Ambient backdrop for Profile / Legal / Admin sub-screens.
 *
 * Static layered glows produce a futuristic gold-tinted cyber-luxury feel
 * without animation overhead. Pure RN primitives — no native deps.
 */
export default function ProfileAmbientBackground() {
  return (
    <View pointerEvents="none" style={styles.layer}>
      <View style={styles.base} />
      <View style={styles.glowTop} />
      <View style={styles.glowBottom} />
      <View style={styles.scanLine} />
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
  glowTop: {
    position: "absolute",
    top: -160,
    left: "50%",
    marginLeft: -200,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(245,200,66,0.07)",
    opacity: 0.95,
  },
  glowBottom: {
    position: "absolute",
    bottom: -180,
    right: -120,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(245,200,66,0.04)",
  },
  scanLine: {
    position: "absolute",
    left: 0,
    right: 0,
    top: "38%",
    height: 1,
    backgroundColor: "rgba(245,200,66,0.06)",
  },
});
