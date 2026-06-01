import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ManageRoleUserCard, { type RoleCardAction } from "../../components/ManageRoleUserCard";
import GlowButton from "../../components/GlowButton";
import {
  fetchAdminUsers,
  updateAdminUserRole,
  updateAdminUserStatus,
  type AdminUserRow,
} from "../../services/adminUsersApi";
import { useAuth } from "../../services/authContext";
import { theme } from "../../constants/theme";
import { userFacingApiError } from "../../utils/userFacingApiError";
import {
  MANAGEABLE_ROLES,
  demoteRole,
  normalizeRoleKey,
  promoteRole,
  roleLabel,
  validateRemoveAccess,
  validateRoleChange,
  validateStatusChange,
  type ManageableRoleKey,
} from "../../utils/roleManagementPolicy";

type PendingAction = {
  user: AdminUserRow;
  action: RoleCardAction;
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
};

type RoleFilter = "all" | ManageableRoleKey;
type StatusFilter = "all" | "active" | "disabled";

const ROLE_FILTERS: { key: RoleFilter; label: string }[] = [
  { key: "all", label: "All roles" },
  ...MANAGEABLE_ROLES.map((r) => ({ key: r.key as RoleFilter, label: r.label })),
];

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All status" },
  { key: "active", label: "Active" },
  { key: "disabled", label: "Suspended" },
];

function ManageRolesInner() {
  const { user: actor } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAdminUsers();
      setUsers(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((row) => {
      if (roleFilter !== "all" && normalizeRoleKey(row.role) !== roleFilter) return false;
      if (statusFilter === "active" && row.status !== "active") return false;
      if (statusFilter === "disabled" && row.status !== "disabled") return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        roleLabel(row.role).toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const patchUser = (updated: AdminUserRow) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const showError = (message: string) => {
    Alert.alert("Action blocked", message);
  };

  const buildPending = (target: AdminUserRow, action: RoleCardAction): PendingAction | null => {
    switch (action.kind) {
      case "setRole": {
        const check = validateRoleChange(actor?.id, target, action.role);
        if (check.ok === false) {
          showError(check.message);
          return null;
        }
        if (normalizeRoleKey(target.role) === action.role) return null;
        return {
          user: target,
          action,
          title: "Change role",
          message: `Assign ${roleLabel(action.role)} to ${target.name}?`,
          confirmLabel: "Update role",
        };
      }
      case "promote": {
        const next = promoteRole(target.role);
        if (!next) return null;
        const check = validateRoleChange(actor?.id, target, next);
        if (check.ok === false) {
          showError(check.message);
          return null;
        }
        return {
          user: target,
          action: { kind: "setRole", role: next },
          title: "Promote user",
          message: `Promote ${target.name} from ${roleLabel(target.role)} to ${roleLabel(next)}?`,
          confirmLabel: "Promote",
        };
      }
      case "demote": {
        const next = demoteRole(target.role);
        if (!next) return null;
        const check = validateRoleChange(actor?.id, target, next);
        if (check.ok === false) {
          showError(check.message);
          return null;
        }
        return {
          user: target,
          action: { kind: "setRole", role: next },
          title: "Demote user",
          message: `Demote ${target.name} from ${roleLabel(target.role)} to ${roleLabel(next)}?`,
          confirmLabel: "Demote",
          danger: true,
        };
      }
      case "suspend": {
        const check = validateStatusChange(actor?.id, target, "disabled");
        if (check.ok === false) {
          showError(check.message);
          return null;
        }
        return {
          user: target,
          action,
          title: "Suspend account",
          message: `Suspend ${target.name}? They will lose platform access until reactivated.`,
          confirmLabel: "Suspend",
          danger: true,
        };
      }
      case "reactivate": {
        const check = validateStatusChange(actor?.id, target, "active");
        if (check.ok === false) {
          showError(check.message);
          return null;
        }
        return {
          user: target,
          action,
          title: "Reactivate account",
          message: `Restore access for ${target.name}?`,
          confirmLabel: "Reactivate",
        };
      }
      case "removeAccess": {
        const check = validateRemoveAccess(actor?.id, target);
        if (check.ok === false) {
          showError(check.message);
          return null;
        }
        return {
          user: target,
          action,
          title: "Remove access",
          message: `Remove platform access for ${target.name}? Their role will reset to Customer and the account will be suspended.`,
          confirmLabel: "Remove access",
          danger: true,
        };
      }
      default:
        return null;
    }
  };

  const onCardAction = (target: AdminUserRow, action: RoleCardAction) => {
    const next = buildPending(target, action);
    if (next) setPending(next);
  };

  const executePending = async () => {
    if (!pending) return;
    const { user: target, action } = pending;
    setPending(null);
    setBusyUserId(target.id);

    try {
      if (action.kind === "setRole") {
        const updated = await updateAdminUserRole(target.id, action.role);
        patchUser(updated);
        setToast(`${target.name} is now ${roleLabel(updated.role)}`);
      } else if (action.kind === "suspend") {
        const updated = await updateAdminUserStatus(target.id, "disabled");
        patchUser(updated);
        setToast(`${target.name} suspended`);
      } else if (action.kind === "reactivate") {
        const updated = await updateAdminUserStatus(target.id, "active");
        patchUser(updated);
        setToast(`${target.name} reactivated`);
      } else if (action.kind === "removeAccess") {
        const updatedRole = await updateAdminUserRole(target.id, "user");
        const updated = await updateAdminUserStatus(updatedRole.id, "disabled");
        patchUser(updated);
        setToast(`Access removed for ${target.name}`);
      }
    } catch (e) {
      showError(userFacingApiError(e));
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <ProfileScreenLayout title="Manage Roles" subtitle="Platform access control" headerTopPad={12}>
      <View style={styles.toolbar}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search name, email, or role"
          placeholderTextColor="rgba(255,255,255,0.35)"
          style={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {ROLE_FILTERS.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              active={roleFilter === chip.key}
              onPress={() => setRoleFilter(chip.key)}
            />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {STATUS_FILTERS.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              active={statusFilter === chip.key}
              onPress={() => setStatusFilter(chip.key)}
            />
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      ) : (
        <>
          <Text style={styles.count}>
            {filtered.length} of {users.length} accounts · live roster
          </Text>
          <View style={styles.list}>
            {filtered.map((row) => (
              <ManageRoleUserCard
                key={row.id}
                user={row}
                actorId={actor?.id}
                busy={busyUserId === row.id}
                onAction={(action) => onCardAction(row, action)}
              />
            ))}
          </View>
          {filtered.length === 0 ? (
            <Text style={styles.empty}>No users match your filters. Adjust search or refresh the roster.</Text>
          ) : null}
          <GlowButton label="Refresh roster" variant="outline" onPress={load} disabled={loading || busyUserId != null} />
        </>
      )}

      {toast ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal visible={pending != null} transparent animationType="fade" onRequestClose={() => setPending(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>{pending?.title}</Text>
            <Text style={styles.confirmMessage}>{pending?.message}</Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setPending(null)}
                style={({ pressed }) => [styles.confirmBtn, styles.confirmCancel, pressed && styles.confirmPressed]}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => void executePending()}
                style={({ pressed }) => [
                  styles.confirmBtn,
                  pending?.danger ? styles.confirmDanger : styles.confirmPrimary,
                  pressed && styles.confirmPressed,
                ]}
              >
                <Text style={styles.confirmPrimaryText}>{pending?.confirmLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ProfileScreenLayout>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        active && styles.filterChipActive,
        pressed && styles.filterChipPressed,
      ]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export default function ManageRolesScreen() {
  return <ManageRolesInner />;
}

const styles = StyleSheet.create({
  toolbar: { gap: 10, marginBottom: 12 },
  searchInput: {
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
  },
  filterRow: { gap: 8, paddingVertical: 2 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  filterChipActive: {
    borderColor: "rgba(245,200,66,0.75)",
    backgroundColor: "rgba(245,200,66,0.12)",
  },
  filterChipPressed: { opacity: 0.88 },
  filterChipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  filterChipTextActive: { color: theme.colors.gold, fontWeight: "800" },
  loader: { marginTop: 32, marginBottom: 8 },
  count: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  list: { gap: 12, marginBottom: 12 },
  empty: {
    color: theme.colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: "rgba(17,17,17,0.96)",
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.35)",
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...theme.shadow.glowGold,
  },
  toastText: { color: theme.colors.gold, fontSize: 13, fontWeight: "700", textAlign: "center" },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#0f0f0f",
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.32)",
    padding: 18,
    ...theme.shadow.glowGold,
  },
  confirmTitle: { color: theme.colors.gold, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  confirmMessage: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 21, marginBottom: 16 },
  confirmActions: { flexDirection: "row", gap: 10 },
  confirmBtn: {
    flex: 1,
    borderRadius: theme.radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  confirmCancel: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)" },
  confirmPrimary: { borderColor: "rgba(245,200,66,0.45)", backgroundColor: "rgba(245,200,66,0.14)" },
  confirmDanger: { borderColor: "rgba(255,107,107,0.45)", backgroundColor: "rgba(255,107,107,0.12)" },
  confirmPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  confirmCancelText: { color: theme.colors.textMuted, fontWeight: "700" },
  confirmPrimaryText: { color: theme.colors.gold, fontWeight: "800" },
});
