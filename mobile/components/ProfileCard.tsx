import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { palette, radius, shadow } from "../constants/theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Adds a soft gold glow halo. Use only on hero/active cards. */
  glow?: boolean;
};

/**
 * Profile-section card — futuristic glass surface with a thin gold border,
 * subtle top highlight (faux-glass top edge), and bottom inset shadow.
 *
 * Visual contract (aligned with CardContainer):
 *  - Surface : palette.surface (dark translucent)
 *  - Border  : palette.borderGold (1px gold hairline)
 *  - Radius  : radius.lg
 *  - Shadow  : shadow.soft (always); shadow.glowGoldSoft (when `glow`)
 */
export default function ProfileCard({ children, style, glow = false }: Props) {
  return (
    <View style={[styles.card, glow && styles.glow, style]}>
      <View pointerEvents="none" style={styles.topHighlight} />
      <View pointerEvents="none" style={styles.bottomShadow} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: palette.borderGold,
    padding: 18,
    overflow: "hidden",
    ...shadow.soft,
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
