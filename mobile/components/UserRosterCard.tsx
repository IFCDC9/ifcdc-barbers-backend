import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import UserAvatar from "./UserAvatar";
import { theme } from "../constants/theme";
import { formatUserRole, type AdminUserRow } from "../services/adminUsersApi";
import { loadAdminUserAvatar } from "../services/adminUserLocalStore";

type Props = {
  user: AdminUserRow;
  onPress: () => void;
};

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

export default function UserRosterCard({ user, onPress }: Props) {
  const [avatarUri, setAvatarUri] = useState<string | null>(user.profileImageUrl || null);
  const status = user.status === "disabled" ? "Disabled" : "Active";

  useEffect(() => {
    let active = true;
    void loadAdminUserAvatar(user.id).then((uri) => {
      if (active) setAvatarUri(uri || user.profileImageUrl || null);
    });
    return () => {
      active = false;
    };
  }, [user.id, user.profileImageUrl]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${user.name}`}
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      <ProfileCard style={styles.card}>
        <View style={styles.row}>
          <UserAvatar name={user.name} email={user.email} uri={avatarUri} size={52} />
          <View style={styles.copy}>
            <Text style={styles.name}>{user.name}</Text>
            <MetaLine label="Email" value={user.email} />
            <MetaLine label="Role" value={formatUserRole(user.role)} />
            <MetaLine label="Status" value={status} />
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
  card: { paddingVertical: 12, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
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
    minWidth: 52,
  },
  metaValue: {
    color: theme.colors.text,
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  chevronWrap: { width: 28, alignItems: "center", justifyContent: "center" },
  chevron: { color: theme.colors.gold, fontSize: 24, fontWeight: "300" },
});
