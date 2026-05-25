import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import { theme } from "../constants/theme";
import type { BarberListRow } from "../services/barberScheduleApi";

type Props = {
  barber: BarberListRow;
  onPress: () => void;
};

export default function BarberRosterCard({ barber, onPress }: Props) {
  const name = barber.name || `Barber ${barber.id}`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${name}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <ProfileCard style={styles.card}>
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.name}>{name}</Text>
            {barber.phone ? <Text style={styles.meta}>{barber.phone}</Text> : null}
            <Text style={styles.meta}>ID: {String(barber.id)}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </View>
      </ProfileCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  card: { paddingVertical: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 4 },
  name: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  meta: { color: theme.colors.textMuted, fontSize: 13 },
  chevron: { color: theme.colors.gold, fontSize: 26, fontWeight: "300" },
});
