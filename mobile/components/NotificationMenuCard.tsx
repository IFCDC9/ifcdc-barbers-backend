import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import { theme } from "../constants/theme";

type Props = {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
};

export default function NotificationMenuCard({ title, subtitle, icon, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
    >
      <ProfileCard style={[styles.card, styles.cardGlow]}>
        <View style={styles.row}>
          <Text style={styles.icon}>{icon}</Text>
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </ProfileCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: theme.radius.lg },
  wrapPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.992 }],
  },
  card: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderColor: "rgba(245,200,66,0.35)",
  },
  cardGlow: {
    ...theme.shadow.glowGold,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  icon: { fontSize: 26, width: 34, textAlign: "center" },
  copy: { flex: 1, gap: 4 },
  title: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  subtitle: {
    color: theme.colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
  },
  chevron: { color: theme.colors.gold, fontSize: 24, fontWeight: "300" },
});
