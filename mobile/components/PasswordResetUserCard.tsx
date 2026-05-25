import React, { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import UserAvatar from "./UserAvatar";
import { theme } from "../constants/theme";
import { formatUserRole, type AdminUserRow } from "../services/adminUsersApi";
import { loadAdminUserAvatar } from "../services/adminUserLocalStore";
import { isMasterAccount } from "../utils/roleManagementPolicy";

type Props = {
  user: AdminUserRow;
  selected: boolean;
  onPress: () => void;
};

export default function PasswordResetUserCard({ user, selected, onPress }: Props) {
  const [avatarUri, setAvatarUri] = useState<string | null>(user.profileImageUrl || null);
  const scale = useRef(new Animated.Value(1)).current;
  const protectedAccount = isMasterAccount(user);
  const status = user.status === "disabled" ? "Suspended" : "Active";

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
      disabled={protectedAccount}
      onPressIn={() => Animated.spring(scale, { toValue: 0.99, useNativeDriver: true, speed: 30 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start()}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <ProfileCard style={[styles.card, styles.glass, selected && styles.cardSelected, protectedAccount && styles.cardLocked]}>
          {selected ? <View style={styles.glow} pointerEvents="none" /> : null}
          <View style={styles.row}>
            <UserAvatar name={user.name} email={user.email} uri={avatarUri} size={50} />
            <View style={styles.copy}>
              <Text style={styles.name} numberOfLines={1}>
                {user.name}
              </Text>
              <Text style={styles.email} numberOfLines={1}>
                {user.email}
              </Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>{formatUserRole(user.role)}</Text>
                <View style={[styles.statusPill, user.status === "disabled" ? styles.statusSuspended : styles.statusActive]}>
                  <Text style={styles.statusText}>{status}</Text>
                </View>
              </View>
            </View>
            {selected ? <Text style={styles.check}>✓</Text> : null}
          </View>
        </ProfileCard>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderColor: "rgba(245,200,66,0.22)",
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
  },
  glass: { borderWidth: 1 },
  cardSelected: { borderColor: "rgba(245,200,66,0.75)", ...theme.shadow.glowGold },
  cardLocked: { opacity: 0.45 },
  glow: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(245,200,66,0.12)" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  copy: { flex: 1, gap: 3 },
  name: { color: theme.colors.gold, fontSize: 15, fontWeight: "800" },
  email: { color: theme.colors.textMuted, fontSize: 13 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  meta: { color: theme.colors.text, fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },
  statusActive: { borderColor: "rgba(124,255,122,0.35)", backgroundColor: "rgba(124,255,122,0.1)" },
  statusSuspended: { borderColor: "rgba(255,107,107,0.35)", backgroundColor: "rgba(255,107,107,0.1)" },
  statusText: { color: theme.colors.textMuted, fontSize: 10, fontWeight: "700", textTransform: "uppercase" },
  check: { color: theme.colors.gold, fontSize: 22, fontWeight: "800" },
});
