import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "../constants/theme";

type Props = {
  onPress: () => void;
};

export default function AIFloatingButton({ onPress }: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          android_ripple={{ color: "rgba(245,200,66,0.22)" }}
        >
          <View style={styles.glow} />
          <Text style={styles.ai}>AI</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 18,
    bottom: 22,
    zIndex: 50,
    elevation: 50,
    pointerEvents: "box-none",
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...theme.shadow.glowGold,
  },
  glow: {
    position: "absolute",
    top: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 140,
    backgroundColor: "rgba(245,200,66,0.16)",
  },
  ai: {
    color: theme.colors.gold,
    fontWeight: "900",
    letterSpacing: 1,
    fontSize: 16,
  },
  pressed: { opacity: 0.92 },
});

