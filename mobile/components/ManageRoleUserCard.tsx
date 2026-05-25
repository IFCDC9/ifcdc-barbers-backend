import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ProfileCard from "./ProfileCard";
import UserAvatar from "./UserAvatar";
import { theme } from "../constants/theme";
import { type AdminUserRow } from "../services/adminUsersApi";
import { loadAdminUserAvatar } from "../services/adminUserLocalStore";
import {
  MANAGEABLE_ROLES,
  demoteRole,
  isMasterAccount,
  normalizeRoleKey,
  promoteRole,
  roleLabel,
  type ManageableRoleKey,
} from "../utils/roleManagementPolicy";

export type RoleCardAction =
  | { kind: "setRole"; role: ManageableRoleKey }
  | { kind: "promote" }
  | { kind: "demote" }
  | { kind: "suspend" }
  | { kind: "reactivate" }
  | { kind: "removeAccess" };

type Props = {
  user: AdminUserRow;
  actorId?: string;
  busy?: boolean;
  onAction: (action: RoleCardAction) => void;
};

function StatusPill({ status }: { status: "active" | "disabled" }) {
  const active = status === "active";
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillSuspended]}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextSuspended]}>
        {active ? "Active" : "Suspended"}
      </Text>
    </View>
  );
}

export default function ManageRoleUserCard({ user, actorId, busy = false, onAction }: Props) {
  const [avatarUri, setAvatarUri] = useState<string | null>(user.profileImageUrl || null);
  const [menuOpen, setMenuOpen] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;
  const currentRole = normalizeRoleKey(user.role);
  const isSelf = actorId === user.id;
  const master = isMasterAccount(user);
  const canPromote = promoteRole(user.role) != null && !master;
  const canDemote = demoteRole(user.role) != null && !master && !(isSelf && currentRole === "super_admin");
  const isSuspended = user.status === "disabled";

  useEffect(() => {
    let active = true;
    void loadAdminUserAvatar(user.id).then((uri) => {
      if (active) setAvatarUri(uri || user.profileImageUrl || null);
    });
    return () => {
      active = false;
    };
  }, [user.id, user.profileImageUrl]);

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.992, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };

  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  const runMenuAction = (action: RoleCardAction) => {
    setMenuOpen(false);
    onAction(action);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <ProfileCard style={[styles.card, styles.glass]}>
        <View style={styles.header}>
          <UserAvatar name={user.name} email={user.email} uri={avatarUri} size={54} />
          <View style={styles.identity}>
            <Text style={styles.name} numberOfLines={1}>
              {user.name}
            </Text>
            <Text style={styles.email} numberOfLines={1}>
              {user.email}
            </Text>
            <View style={styles.metaRow}>
              <StatusPill status={user.status} />
              <Text style={styles.metaText}>Last login: {user.lastLogin || "Not tracked"}</Text>
            </View>
          </View>
          <Pressable
            onPress={() => setMenuOpen(true)}
            disabled={busy}
            style={({ pressed }) => [styles.menuBtn, pressed && styles.menuBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Actions for ${user.name}`}
          >
            <Text style={styles.menuIcon}>⋮</Text>
          </Pressable>
        </View>

        <View style={styles.roleBlock}>
          <Text style={styles.sectionLabel}>Current role · {roleLabel(user.role)}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roleRow}>
            {MANAGEABLE_ROLES.map((role) => {
              const selected = currentRole === role.key;
              const locked =
                master && role.key !== "super_admin"
                  ? true
                  : role.key === "super_admin" && !master;
              return (
                <Pressable
                  key={role.key}
                  disabled={busy || locked || selected}
                  onPressIn={pressIn}
                  onPressOut={pressOut}
                  onPress={() => onAction({ kind: "setRole", role: role.key })}
                  style={({ pressed }) => [
                    styles.roleChip,
                    selected && styles.roleChipActive,
                    locked && styles.roleChipLocked,
                    pressed && !locked && !selected && styles.roleChipPressed,
                  ]}
                >
                  {selected ? <View style={styles.roleGlow} pointerEvents="none" /> : null}
                  <Text style={[styles.roleChipText, selected && styles.roleChipTextActive]}>{role.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.actions}>
          <ActionChip label="Promote" disabled={busy || !canPromote} onPress={() => onAction({ kind: "promote" })} />
          <ActionChip label="Demote" disabled={busy || !canDemote} onPress={() => onAction({ kind: "demote" })} />
          {isSuspended ? (
            <ActionChip
              label="Reactivate"
              disabled={busy || master}
              accent
              onPress={() => onAction({ kind: "reactivate" })}
            />
          ) : (
            <ActionChip
              label="Suspend"
              disabled={busy || master || isSelf}
              danger
              onPress={() => onAction({ kind: "suspend" })}
            />
          )}
          <ActionChip
            label="Remove access"
            disabled={busy || master || isSelf}
            danger
            onPress={() => onAction({ kind: "removeAccess" })}
          />
        </View>
      </ProfileCard>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenuOpen(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>{user.name}</Text>
            <MenuItem label="Promote" disabled={!canPromote} onPress={() => runMenuAction({ kind: "promote" })} />
            <MenuItem label="Demote" disabled={!canDemote} onPress={() => runMenuAction({ kind: "demote" })} />
            {isSuspended ? (
              <MenuItem
                label="Reactivate"
                disabled={master}
                onPress={() => runMenuAction({ kind: "reactivate" })}
              />
            ) : (
              <MenuItem
                label="Suspend"
                disabled={master || isSelf}
                onPress={() => runMenuAction({ kind: "suspend" })}
              />
            )}
            <MenuItem
              label="Remove access"
              danger
              disabled={master || isSelf}
              onPress={() => runMenuAction({ kind: "removeAccess" })}
            />
            <MenuItem label="Cancel" onPress={() => setMenuOpen(false)} />
          </View>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

function ActionChip({
  label,
  onPress,
  disabled,
  danger,
  accent,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.actionChip,
        danger && styles.actionChipDanger,
        accent && styles.actionChipAccent,
        disabled && styles.actionChipDisabled,
        pressed && !disabled && styles.actionChipPressed,
      ]}
    >
      <Text
        style={[
          styles.actionChipText,
          danger && styles.actionChipTextDanger,
          accent && styles.actionChipTextAccent,
          disabled && styles.actionChipTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function MenuItem({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.menuItem, pressed && !disabled && styles.menuItemPressed, disabled && styles.menuItemDisabled]}
    >
      <Text style={[styles.menuItemText, danger && styles.menuItemTextDanger, disabled && styles.menuItemTextDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderColor: "rgba(245,200,66,0.32)",
    backgroundColor: "rgba(255,255,255,0.03)",
    overflow: "hidden",
    ...theme.shadow.glowGold,
  },
  glass: {
    borderWidth: 1,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  identity: { flex: 1, gap: 3 },
  name: {
    color: theme.colors.gold,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  email: { color: theme.colors.textMuted, fontSize: 13, fontWeight: "500" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4, flexWrap: "wrap" },
  metaText: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "500" },
  menuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.25)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  menuBtnPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  menuIcon: { color: theme.colors.gold, fontSize: 20, fontWeight: "700", marginTop: -2 },
  roleBlock: { marginTop: 14, gap: 8 },
  sectionLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  roleRow: { gap: 8, paddingVertical: 2 },
  roleChip: {
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
  },
  roleChipActive: {
    borderColor: "rgba(245,200,66,0.85)",
    backgroundColor: "rgba(245,200,66,0.14)",
  },
  roleChipLocked: { opacity: 0.35 },
  roleChipPressed: { backgroundColor: "rgba(245,200,66,0.08)" },
  roleGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245,200,66,0.18)",
    borderRadius: 999,
  },
  roleChipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  roleChipTextActive: { color: theme.colors.gold, fontWeight: "800" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  actionChipDanger: { borderColor: "rgba(255,107,107,0.35)", backgroundColor: "rgba(255,107,107,0.08)" },
  actionChipAccent: { borderColor: "rgba(124,255,122,0.35)", backgroundColor: "rgba(124,255,122,0.08)" },
  actionChipDisabled: { opacity: 0.35 },
  actionChipPressed: { transform: [{ scale: 0.97 }] },
  actionChipText: { color: theme.colors.gold, fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  actionChipTextDanger: { color: theme.colors.danger },
  actionChipTextAccent: { color: theme.colors.neon },
  actionChipTextDisabled: { color: theme.colors.textMuted },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  pillActive: { borderColor: "rgba(124,255,122,0.35)", backgroundColor: "rgba(124,255,122,0.1)" },
  pillSuspended: { borderColor: "rgba(255,107,107,0.35)", backgroundColor: "rgba(255,107,107,0.1)" },
  pillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  pillTextActive: { color: theme.colors.neon },
  pillTextSuspended: { color: theme.colors.danger },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    padding: 16,
  },
  menuSheet: {
    backgroundColor: "#111",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.28)",
    paddingVertical: 8,
    ...theme.shadow.glowGold,
  },
  menuTitle: {
    color: theme.colors.gold,
    fontSize: 14,
    fontWeight: "800",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  menuItem: { paddingHorizontal: 16, paddingVertical: 14 },
  menuItemPressed: { backgroundColor: "rgba(245,200,66,0.08)" },
  menuItemDisabled: { opacity: 0.35 },
  menuItemText: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  menuItemTextDanger: { color: theme.colors.danger },
  menuItemTextDisabled: { color: theme.colors.textMuted },
});
