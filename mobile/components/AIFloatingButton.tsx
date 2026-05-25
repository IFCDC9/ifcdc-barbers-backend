import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, shadow } from "../constants/theme";

/** Clearance above bottom tab bar (icons + labels). Keep in sync with app/_layout.tsx. */
const TAB_BAR_HEIGHT = 60;

type Props = {
  onPress: () => void;
};

/**
 * AURA floating orb — text-only assistant entry point.
 *
 * Visual contract:
 *  - Premium glass-disc with gold border + gold inner ring
 *  - Soft pulsing halo (single low-amplitude loop, native driver)
 *  - Press scale-in micro-interaction
 *
 * Accessibility:
 *  - Role: button
 *  - Label: "Ask AURA — text-only assistant" (announces text-only nature)
 *
 * Hard constraint: AURA is text-only. There is no microphone, no voice
 * capture, no calls — and no UI affordance suggesting otherwise here.
 */
export default function AIFloatingButton({ onPress }: Props) {
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const pressIn = () => {
    Animated.spring(scale, {
      toValue: 0.93,
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

  const haloOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.7] });
  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.22] });
  const innerOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] });

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TAB_BAR_HEIGHT + 12 }]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.haloOuter,
          { opacity: haloOpacity, transform: [{ scale: haloScale }] },
        ]}
      />
      <Animated.View
        pointerEvents="none"
        style={[styles.haloInner, { opacity: innerOpacity }]}
      />
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          accessibilityRole="button"
          accessibilityLabel="Ask AURA — text-only assistant"
          style={({ pressed }) => [styles.fab, pressed && styles.pressed]}
          android_ripple={{ color: "rgba(245,200,66,0.22)", borderless: true }}
        >
          <View style={styles.innerRing} />
          <Text style={styles.label}>AURA</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 20,
    zIndex: 50,
    elevation: 50,
    alignItems: "center",
    justifyContent: "center",
    width: 80,
    height: 80,
    pointerEvents: "box-none",
  },
  haloOuter: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(245,200,66,0.32)",
  },
  haloInner: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(245,200,66,0.16)",
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: palette.bg2,
    borderWidth: 1.5,
    borderColor: palette.borderGoldStrong,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.glowGoldStrong,
  },
  innerRing: {
    position: "absolute",
    top: 4,
    left: 4,
    right: 4,
    bottom: 4,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.40)",
  },
  label: {
    color: palette.gold,
    fontWeight: "900",
    letterSpacing: 1.4,
    fontSize: 11.5,
  },
  pressed: { opacity: 0.95 },
});
