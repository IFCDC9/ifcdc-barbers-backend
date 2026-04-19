import React from "react";
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import { theme } from "../constants/theme";

type Props = {
  label?: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function GoogleButton({
  label = "Continue with Google",
  onPress,
  disabled,
  style,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        pressed && !disabled ? styles.pressed : null,
        disabled ? styles.disabled : null,
        style,
      ]}
    >
      <View style={styles.row}>
        <View style={styles.iconWrap}>
          <Text style={styles.g}>G</Text>
        </View>
        <Text style={styles.text} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.spacer} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.55,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 22,
    height: 22,
    borderRadius: 6,
    backgroundColor: "rgba(0,0,0,0.03)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  g: { fontWeight: "900", fontSize: 14, color: "#4285F4" },
  text: {
    flex: 1,
    color: "#111",
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  spacer: { width: 22 },
});

