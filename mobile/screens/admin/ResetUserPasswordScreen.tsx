import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import type { AdminStackParamList } from "../../navigation/AdminStack";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import PasswordResetUserCard from "../../components/PasswordResetUserCard";
import GlowButton from "../../components/GlowButton";
import { fetchAdminUsers, type AdminUserRow } from "../../services/adminUsersApi";
import {
  generateSecureTempPassword,
  resetPasswordAdmin,
  sendPasswordResetEmail,
} from "../../services/adminPasswordResetApi";
import { useAuth } from "../../services/authContext";
import { theme } from "../../constants/theme";
import { UX } from "../../utils/uxCopy";
import {
  resetMethodLabel,
  validatePasswordResetTarget,
  type ResetMethodKey,
} from "../../utils/passwordResetPolicy";

type PendingReset = {
  methods: ResetMethodKey[];
  title: string;
  message: string;
};

const METHOD_KEYS: ResetMethodKey[] = ["send_email", "temp_password", "force_change", "disable_until_reset"];

type ResetRoute = RouteProp<AdminStackParamList, "ResetUserPasswordScreen">;

export default function ResetUserPasswordScreen() {
  const route = useRoute<ResetRoute>();
  const preselectedUserId = route.params?.userId;
  const { user: actor } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [methods, setMethods] = useState<Record<ResetMethodKey, boolean>>({
    send_email: true,
    temp_password: false,
    force_change: false,
    disable_until_reset: false,
  });
  const [previewPassword, setPreviewPassword] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReset | null>(null);

  const successOpacity = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.8)).current;

  const selected = useMemo(() => users.find((u) => u.id === selectedId) ?? null, [users, selectedId]);

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
    if (preselectedUserId && users.some((u) => u.id === preselectedUserId)) {
      setSelectedId(preselectedUserId);
    }
  }, [preselectedUserId, users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        String(u.role || "").toLowerCase().includes(q),
    );
  }, [users, search]);

  const playSuccess = (message: string, tempPassword?: string | null) => {
    setSuccessMessage(message);
    setPreviewPassword(tempPassword ?? null);
    successOpacity.setValue(0);
    badgeScale.setValue(0.8);
    Animated.parallel([
      Animated.timing(successOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }),
    ]).start();
    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setSuccessMessage(null);
      });
    }, 4200);
  };

  const activeMethods = METHOD_KEYS.filter((k) => methods[k]);

  const openConfirm = () => {
    const check = validatePasswordResetTarget(actor?.id, actor?.email, selected);
    if (check.ok === false) {
      Alert.alert("Recovery blocked", check.message);
      return;
    }
    if (activeMethods.length === 0) {
      Alert.alert("Select a method", "Choose at least one recovery action.");
      return;
    }
    setPending({
      methods: activeMethods,
      title: "Confirm account recovery",
      message: `Apply ${activeMethods.map(resetMethodLabel).join(", ")} to ${selected?.name}?`,
    });
  };

  const executeRecovery = async () => {
    if (!pending || !selected) return;
    const target = selected;
    setPending(null);
    setBusy(true);

    try {
      let tempPassword: string | null = null;
      let summary = "Account recovery initiated";

      if (pending.methods.includes("send_email")) {
        const r = await sendPasswordResetEmail(target.id);
        summary = r.message;
      }

      if (
        pending.methods.includes("temp_password") ||
        pending.methods.includes("disable_until_reset") ||
        pending.methods.includes("force_change")
      ) {
        tempPassword = pending.methods.includes("temp_password") ? generateSecureTempPassword() : null;
        const r = await resetPasswordAdmin({
          userId: target.id,
          generateTemporary: pending.methods.includes("temp_password"),
          temporaryPassword: tempPassword ?? undefined,
          disableUntilReset: pending.methods.includes("disable_until_reset"),
          forcePasswordChange: pending.methods.includes("force_change"),
        });
        tempPassword = r.temporaryPassword ?? tempPassword;
        summary = r.message;
      }

      playSuccess(summary, tempPassword);
    } catch {
      Alert.alert("Recovery", UX.errorGeneric);
    } finally {
      setBusy(false);
    }
  };

  const copyTempPassword = async () => {
    if (!previewPassword) return;
    try {
      await Share.share({ message: `IFCDC temporary password: ${previewPassword}` });
    } catch {
      Alert.alert("Temporary password", previewPassword);
    }
  };

  return (
    <ProfileScreenLayout title="Reset User Password" subtitle="Account recovery console" headerTopPad={12}>
      {successMessage ? (
        <Animated.View style={[styles.successBanner, { opacity: successOpacity }]}>
          <Animated.View style={[styles.successBadge, { transform: [{ scale: badgeScale }] }]}>
            <Text style={styles.successIcon}>✓</Text>
          </Animated.View>
          <Text style={styles.successTitle}>{successMessage}</Text>
          {previewPassword ? (
            <Pressable onPress={() => void copyTempPassword()} style={styles.tempBox}>
              <Text style={styles.tempLabel}>Temporary password · tap to share</Text>
              <Text style={styles.tempValue}>{previewPassword}</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search users by name, email, or role"
        placeholderTextColor="rgba(255,255,255,0.35)"
        style={styles.searchInput}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {loading ? (
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      ) : (
        <View style={styles.userList}>
          {filtered.map((user) => (
            <PasswordResetUserCard
              key={user.id}
              user={user}
              selected={selectedId === user.id}
              onPress={() => setSelectedId(user.id)}
            />
          ))}
        </View>
      )}

      {selected ? (
        <ProfileCard style={[styles.methodCard, styles.glass]}>
          <Text style={styles.sectionTitle}>Recovery methods · {selected.name}</Text>
          {METHOD_KEYS.map((key) => (
            <MethodToggle
              key={key}
              label={resetMethodLabel(key)}
              value={methods[key]}
              onValueChange={(v) => setMethods((prev) => ({ ...prev, [key]: v }))}
            />
          ))}
          <GlowButton
            label={busy ? "Processing…" : "Execute recovery"}
            onPress={openConfirm}
            disabled={busy || !selected}
            loading={busy}
            style={styles.executeBtn}
          />
        </ProfileCard>
      ) : (
        <Text style={styles.hint}>Select a user above to configure recovery actions.</Text>
      )}

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
                onPress={() => void executeRecovery()}
                style={({ pressed }) => [styles.confirmBtn, styles.confirmPrimary, pressed && styles.confirmPressed]}
              >
                <Text style={styles.confirmPrimaryText}>Confirm reset</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ProfileScreenLayout>
  );
}

function MethodToggle({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "rgba(255,255,255,0.15)", true: "rgba(245,200,66,0.45)" }}
        thumbColor={value ? theme.colors.gold : "#888"}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.colors.text,
    fontSize: 15,
    marginBottom: 10,
  },
  loader: { marginVertical: 20 },
  userList: { gap: 8, marginBottom: 12 },
  methodCard: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderColor: "rgba(245,200,66,0.32)",
    backgroundColor: "rgba(255,255,255,0.03)",
    ...theme.shadow.glowGold,
  },
  glass: { borderWidth: 1 },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.7,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
  },
  toggleLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "600", flex: 1, paddingRight: 12 },
  executeBtn: { marginTop: 14 },
  hint: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 12 },
  successBanner: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.45)",
    backgroundColor: "rgba(245,200,66,0.08)",
    ...theme.shadow.glowGold,
  },
  successBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successIcon: { color: theme.colors.gold, fontSize: 24, fontWeight: "800" },
  successTitle: { color: theme.colors.gold, fontSize: 15, fontWeight: "800", textAlign: "center" },
  tempBox: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.35)",
    backgroundColor: "rgba(0,0,0,0.25)",
    width: "100%",
  },
  tempLabel: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "600", marginBottom: 4 },
  tempValue: { color: theme.colors.gold, fontSize: 16, fontWeight: "800", letterSpacing: 1 },
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
  confirmBtn: { flex: 1, borderRadius: theme.radius.sm, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  confirmCancel: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)" },
  confirmPrimary: { borderColor: "rgba(245,200,66,0.45)", backgroundColor: "rgba(245,200,66,0.14)" },
  confirmPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  confirmCancelText: { color: theme.colors.textMuted, fontWeight: "700" },
  confirmPrimaryText: { color: theme.colors.gold, fontWeight: "800" },
});
