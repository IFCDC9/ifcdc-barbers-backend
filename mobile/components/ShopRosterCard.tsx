import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import { theme } from "../constants/theme";
import type { ShopRow } from "../services/shopStaffApi";

type Props = {
  shop: ShopRow;
  onPress: () => void;
};

function formatStatus(status?: string | null): string {
  const raw = String(status || "active").trim().toLowerCase();
  if (!raw || raw === "coming_soon") return "Active";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function MetaLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaLine}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

export default function ShopRosterCard({ shop, onPress }: Props) {
  const name = shop.name || `Shop ${shop.business_id}`;

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
            <MetaLine label="Business ID" value={String(shop.business_id)} />
            {shop.owner_name ? <MetaLine label="Owner" value={shop.owner_name} /> : null}
            <MetaLine label="Status" value={formatStatus(shop.status)} />
            <Text style={styles.stats}>
              {shop.barber_count ?? 0} barbers · {shop.booking_count ?? 0} bookings
            </Text>
          </View>
          <View style={styles.chevronWrap}>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>
      </ProfileCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.9, transform: [{ scale: 0.992 }] },
  card: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  copy: { flex: 1, gap: 5 },
  name: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  metaLine: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  metaLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    minWidth: 78,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  stats: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  chevronWrap: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  chevron: { color: theme.colors.gold, fontSize: 24, fontWeight: "300" },
});
