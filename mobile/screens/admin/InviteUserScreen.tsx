import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import PendingInviteCard from "../../components/PendingInviteCard";
import GlowButton from "../../components/GlowButton";
import {
  cancelInvite,
  collectInviteBlocklistEmails,
  fetchPendingInvites,
  resendInvite,
  sendInviteUser,
  type PendingInviteRow,
} from "../../services/adminInviteApi";
import { fetchShopList, type ShopRow } from "../../services/shopStaffApi";
import { useAuth } from "../../services/authContext";
import { isSuperAdminUser } from "../../utils/adminAccess";
import { theme } from "../../constants/theme";
import { UX } from "../../utils/uxCopy";
import { userFacingApiError } from "../../utils/userFacingApiError";
import {
  MANAGEABLE_ROLES,
  validateInviteForm,
  type InviteFormInput,
} from "../../utils/inviteUserPolicy";
import { normalizeRoleKey, roleLabel, type ManageableRoleKey } from "../../utils/roleManagementPolicy";

function InviteUserInner() {
  const { user, token } = useAuth();
  const actorIsSuperAdmin = isSuperAdminUser(user, token);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<ManageableRoleKey>("barber");
  const [businessId, setBusinessId] = useState<string | number | null>(null);
  const [sendSms, setSendSms] = useState(false);
  const [welcomeNote, setWelcomeNote] = useState("");
  const [sendInvite, setSendInvite] = useState(true);

  const [shops, setShops] = useState<ShopRow[]>([]);
  const [invites, setInvites] = useState<PendingInviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successNote, setSuccessNote] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<PendingInviteRow | null>(null);

  const badgeScale = useRef(new Animated.Value(0)).current;
  const badgeGlow = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;

  const selectedShop = useMemo(
    () => shops.find((s) => String(s.business_id) === String(businessId ?? "")),
    [shops, businessId],
  );

  const needsShop = role === "barber" || role === "shop_owner";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shopRows, pending] = await Promise.all([fetchShopList(), fetchPendingInvites()]);
      setShops(shopRows);
      setInvites(pending.filter((i) => i.status !== "revoked"));
      setBusinessId((prev) => prev ?? shopRows[0]?.business_id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const playSuccessAnimation = () => {
    setShowSuccess(true);
    badgeScale.setValue(0.6);
    badgeGlow.setValue(0);
    successOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(badgeScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
      Animated.sequence([
        Animated.timing(badgeGlow, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(badgeGlow, { toValue: 0.35, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(successOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.timing(successOpacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
        setShowSuccess(false);
      });
    }, 3200);
  };

  const resetForm = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setWelcomeNote("");
    setSendSms(false);
    setSendInvite(true);
    if (!actorIsSuperAdmin) setRole("barber");
  };

  const handleSendInvite = async () => {
    const blocklist = await collectInviteBlocklistEmails();
    const input: InviteFormInput = {
      fullName,
      email,
      phone,
      role,
      businessId: needsShop ? businessId : null,
      welcomeNote,
      sendInvite,
      sendSms: false,
    };
    const check = validateInviteForm(input, { actorIsSuperAdmin, existingEmails: blocklist });
    if (check.ok === false) {
      Alert.alert("Check invite details", check.message);
      return;
    }

    setSubmitting(true);
    try {
      const { invite: created, smsWarning } = await sendInviteUser({
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || null,
        role: normalizeRoleKey(role),
        businessId: needsShop ? businessId : null,
        businessName: selectedShop?.name ?? null,
        welcomeNote: welcomeNote.trim() || null,
        sendInvite,
        sendSms: false,
      });
      setInvites((prev) => [created, ...prev.filter((i) => i.id !== created.id)]);
      setSuccessNote(smsWarning);
      playSuccessAnimation();
      resetForm();
    } catch {
      Alert.alert("Invite", UX.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (invite: PendingInviteRow) => {
    setBusyInviteId(invite.id);
    try {
      const updated = await resendInvite(invite.id);
      setInvites((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      playSuccessAnimation();
    } catch {
      Alert.alert("Resend", UX.errorGeneric);
    } finally {
      setBusyInviteId(null);
    }
  };

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    const id = revokeTarget.id;
    setRevokeTarget(null);
    setBusyInviteId(id);
    try {
      await cancelInvite(id);
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      Alert.alert("Revoke failed", userFacingApiError(e));
    } finally {
      setBusyInviteId(null);
    }
  };

  const glowOpacity = badgeGlow.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
    >
      <ProfileScreenLayout title="Invite User" subtitle="Add team members to the platform" headerTopPad={12}>
        {showSuccess ? (
          <Animated.View style={[styles.successBanner, { opacity: successOpacity }]}>
            <Animated.View style={[styles.successGlow, { opacity: glowOpacity }]} pointerEvents="none" />
            <Animated.View style={[styles.successBadge, { transform: [{ scale: badgeScale }] }]}>
              <Text style={styles.successBadgeIcon}>✓</Text>
            </Animated.View>
            <Text style={styles.successTitle}>Invitation sent successfully</Text>
            <Text style={styles.successSub}>
              {successNote || "Onboarding invite is queued for delivery."}
            </Text>
          </Animated.View>
        ) : null}

        <ProfileCard style={[styles.formCard, styles.glass]}>
          <Text style={styles.sectionTitle}>New invitation</Text>

          <Field label="Full name">
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Full name"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              autoCapitalize="words"
            />
          </Field>

          <Field label="Email address">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="name@company.com"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </Field>

          <Field label="Phone number">
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="Optional"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={styles.input}
              keyboardType="phone-pad"
            />
          </Field>

          <Field label="Role">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              {MANAGEABLE_ROLES.map((r) => {
                const locked =
                  (!actorIsSuperAdmin && (r.key === "admin" || r.key === "super_admin")) ||
                  (r.key === "super_admin" && !actorIsSuperAdmin);
                const active = role === r.key;
                return (
                  <Pressable
                    key={r.key}
                    disabled={locked}
                    onPress={() => setRole(r.key)}
                    style={({ pressed }) => [
                      styles.roleChip,
                      active && styles.roleChipActive,
                      locked && styles.roleChipLocked,
                      pressed && !locked && styles.roleChipPressed,
                    ]}
                  >
                    {active ? <View style={styles.roleGlow} pointerEvents="none" /> : null}
                    <Text style={[styles.roleChipText, active && styles.roleChipTextActive]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Field>

          {needsShop ? (
            <Field label="Shop">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {shops.map((shop) => {
                  const id = shop.business_id;
                  const active = String(businessId) === String(id);
                  const label = shop.name || `Shop ${id}`;
                  return (
                    <Pressable
                      key={String(id)}
                      onPress={() => setBusinessId(id)}
                      style={({ pressed }) => [
                        styles.roleChip,
                        active && styles.roleChipActive,
                        pressed && styles.roleChipPressed,
                      ]}
                    >
                      {active ? <View style={styles.roleGlow} pointerEvents="none" /> : null}
                      <Text style={[styles.roleChipText, active && styles.roleChipTextActive]} numberOfLines={1}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Field>
          ) : null}

          <Field label="Welcome note (optional)">
            <TextInput
              value={welcomeNote}
              onChangeText={setWelcomeNote}
              placeholder="Personal message included in the invite email"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={[styles.input, styles.textArea]}
              multiline
              numberOfLines={3}
            />
          </Field>

          <ToggleRow
            label="Send invitation email"
            subtitle="Send an email invitation with account setup instructions"
            value={sendInvite}
            onValueChange={setSendInvite}
          />
          <ToggleRow
            label="Send SMS invite"
            subtitle={UX.smsInviteDisabled}
            value={false}
            onValueChange={() => {
              Alert.alert("SMS invite", UX.smsInviteDisabled);
            }}
            disabled
          />

          <GlowButton
            label={submitting ? "Sending…" : "Send invitation"}
            onPress={() => void handleSendInvite()}
            disabled={submitting || loading}
            loading={submitting}
            style={styles.submitBtn}
          />
        </ProfileCard>

        <Text style={styles.pendingTitle}>Pending invites</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
        ) : invites.length === 0 ? (
          <Text style={styles.empty}>No pending invites. Send your first invitation above.</Text>
        ) : (
          <View style={styles.pendingList}>
            {invites.map((invite) => (
              <PendingInviteCard
                key={invite.id}
                invite={invite}
                busy={busyInviteId === invite.id}
                onResend={() => void handleResend(invite)}
                onRevoke={() => setRevokeTarget(invite)}
              />
            ))}
          </View>
        )}

        <GlowButton label="Refresh invites" variant="outline" onPress={load} disabled={loading || submitting} />
        <View style={styles.keyboardPad} />
      </ProfileScreenLayout>

      <Modal visible={revokeTarget != null} transparent animationType="fade" onRequestClose={() => setRevokeTarget(null)}>
        <View style={styles.confirmBackdrop}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Revoke invitation</Text>
            <Text style={styles.confirmMessage}>
              Cancel the invite for {revokeTarget?.email}? They will not be able to use this onboarding link.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                onPress={() => setRevokeTarget(null)}
                style={({ pressed }) => [styles.confirmBtn, styles.confirmCancel, pressed && styles.confirmPressed]}
              >
                <Text style={styles.confirmCancelText}>Keep</Text>
              </Pressable>
              <Pressable
                onPress={() => void handleRevoke()}
                style={({ pressed }) => [styles.confirmBtn, styles.confirmDanger, pressed && styles.confirmPressed]}
              >
                <Text style={styles.confirmDangerText}>Revoke</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ToggleRow({
  label,
  subtitle,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleSub}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "rgba(255,255,255,0.15)", true: "rgba(245,200,66,0.45)" }}
        thumbColor={value ? theme.colors.gold : "#888"}
      />
    </View>
  );
}

export default function InviteUserScreen() {
  return <InviteUserInner />;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  formCard: {
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderColor: "rgba(245,200,66,0.3)",
    backgroundColor: "rgba(255,255,255,0.03)",
    marginBottom: 14,
    ...theme.shadow.glowGold,
  },
  glass: { borderWidth: 1, overflow: "hidden" },
  sectionTitle: {
    color: theme.colors.gold,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  field: { marginBottom: 12 },
  fieldLabel: {
    color: theme.colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.22)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: theme.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: theme.colors.text,
    fontSize: 15,
  },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  chipRow: { gap: 8, paddingVertical: 2 },
  roleChip: {
    position: "relative",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    overflow: "hidden",
    maxWidth: 200,
  },
  roleChipActive: {
    borderColor: "rgba(245,200,66,0.85)",
    backgroundColor: "rgba(245,200,66,0.14)",
  },
  roleChipLocked: { opacity: 0.35 },
  roleChipPressed: { opacity: 0.9 },
  roleGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245,200,66,0.18)",
    borderRadius: 999,
  },
  roleChipText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "600" },
  roleChipTextActive: { color: theme.colors.gold, fontWeight: "800" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.06)",
    marginTop: 4,
  },
  toggleRowDisabled: { opacity: 0.55 },
  toggleCopy: { flex: 1 },
  toggleLabel: { color: theme.colors.text, fontSize: 14, fontWeight: "700" },
  toggleSub: { color: theme.colors.textMuted, fontSize: 12, marginTop: 2 },
  submitBtn: { marginTop: 14 },
  pendingTitle: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  pendingList: { gap: 10, marginBottom: 12 },
  loader: { marginVertical: 20 },
  empty: { color: theme.colors.textMuted, fontSize: 14, textAlign: "center", marginBottom: 12, lineHeight: 20 },
  keyboardPad: { height: 24 },
  successBanner: {
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 14,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: "rgba(245,200,66,0.45)",
    backgroundColor: "rgba(245,200,66,0.08)",
    overflow: "hidden",
    ...theme.shadow.glowGold,
  },
  successGlow: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245,200,66,0.2)",
  },
  successBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(245,200,66,0.2)",
    borderWidth: 2,
    borderColor: theme.colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  successBadgeIcon: { color: theme.colors.gold, fontSize: 26, fontWeight: "800" },
  successTitle: { color: theme.colors.gold, fontSize: 16, fontWeight: "800", textAlign: "center" },
  successSub: { color: theme.colors.textMuted, fontSize: 13, marginTop: 4, textAlign: "center" },
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
  confirmDanger: { borderColor: "rgba(255,107,107,0.45)", backgroundColor: "rgba(255,107,107,0.12)" },
  confirmPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  confirmCancelText: { color: theme.colors.textMuted, fontWeight: "700" },
  confirmDangerText: { color: theme.colors.danger, fontWeight: "800" },
});
