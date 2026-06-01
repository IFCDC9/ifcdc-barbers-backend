import React, { useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import ProfileCard from "./ProfileCard";
import { theme } from "../constants/theme";
import { formatInviteDate, formatInviteStatus, type PendingInviteRow } from "../services/adminInviteApi";
import { roleLabel } from "../utils/roleManagementPolicy";

type Props = {
  invite: PendingInviteRow;
  busy?: boolean;
  onResend: () => void;
  onRevoke: () => void;
  onDelete: () => void;
};

export default function PendingInviteCard({ invite, busy, onResend, onRevoke, onDelete }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const sent = invite.status === "sent";

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.992, useNativeDriver: true, speed: 30, bounciness: 6 }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <ProfileCard style={[styles.card, styles.glass]}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <Text style={styles.email} numberOfLines={1}>
              {invite.email}
            </Text>
            <Text style={styles.name}>{invite.name}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>Role · {roleLabel(invite.role)}</Text>
              <View style={[styles.statusPill, sent ? styles.statusSent : styles.statusPending]}>
                <Text style={[styles.statusText, sent ? styles.statusTextSent : styles.statusTextPending]}>
                  {formatInviteStatus(invite.status)}
                </Text>
              </View>
            </View>
            <Text style={styles.meta}>Created · {formatInviteDate(invite.createdAt)}</Text>
            {invite.businessName ? (
              <Text style={styles.meta} numberOfLines={1}>
                Shop · {invite.businessName}
              </Text>
            ) : null}
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable
            disabled={busy}
            onPressIn={pressIn}
            onPressOut={pressOut}
            onPress={onResend}
            style={({ pressed }) => [styles.chip, styles.chipPrimary, pressed && styles.chipPressed, busy && styles.chipDisabled]}
          >
            <Text style={styles.chipPrimaryText}>Resend</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onRevoke}
            style={({ pressed }) => [styles.chip, styles.chipDanger, pressed && styles.chipPressed, busy && styles.chipDisabled]}
          >
            <Text style={styles.chipDangerText}>Revoke</Text>
          </Pressable>
          <Pressable
            disabled={busy}
            onPress={onDelete}
            style={({ pressed }) => [styles.chip, styles.chipGhost, pressed && styles.chipPressed, busy && styles.chipDisabled]}
          >
            <Text style={styles.chipGhostText}>Delete</Text>
          </Pressable>
        </View>
      </ProfileCard>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderColor: "rgba(245,200,66,0.28)",
    backgroundColor: "rgba(255,255,255,0.03)",
    ...theme.shadow.glowGold,
  },
  glass: { borderWidth: 1, overflow: "hidden" },
  header: { flexDirection: "row" },
  copy: { flex: 1, gap: 4 },
  email: { color: theme.colors.gold, fontSize: 15, fontWeight: "800" },
  name: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 2 },
  meta: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "500" },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  statusSent: { borderColor: "rgba(124,255,122,0.35)", backgroundColor: "rgba(124,255,122,0.1)" },
  statusPending: { borderColor: "rgba(245,200,66,0.35)", backgroundColor: "rgba(245,200,66,0.1)" },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  statusTextSent: { color: theme.colors.neon },
  statusTextPending: { color: theme.colors.gold },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  chipPrimary: { borderColor: "rgba(245,200,66,0.35)", backgroundColor: "rgba(245,200,66,0.1)" },
  chipDanger: { borderColor: "rgba(255,107,107,0.35)", backgroundColor: "rgba(255,107,107,0.08)" },
  chipGhost: { borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(255,255,255,0.04)" },
  chipPressed: { opacity: 0.88, transform: [{ scale: 0.97 }] },
  chipDisabled: { opacity: 0.4 },
  chipPrimaryText: { color: theme.colors.gold, fontSize: 12, fontWeight: "700" },
  chipDangerText: { color: theme.colors.danger, fontSize: 12, fontWeight: "700" },
  chipGhostText: { color: theme.colors.textMuted, fontSize: 12, fontWeight: "700" },
});
