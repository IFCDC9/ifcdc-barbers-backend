import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  glow?: boolean;
};

export default function CardContainer({ children, style, glow = false }: Props) {
  return (
    <View style={[styles.card, glow && styles.glow, style]}>
      <View style={styles.border} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    overflow: "hidden",
    ...theme.shadow.soft,
  },
  glow: {
    ...theme.shadow.glowGold,
  },
  border: {
    position: "absolute",
    top: -120,
    left: -120,
    width: 260,
    height: 260,
    borderRadius: 260,
    backgroundColor: "rgba(245,200,66,0.08)",
  },
});

