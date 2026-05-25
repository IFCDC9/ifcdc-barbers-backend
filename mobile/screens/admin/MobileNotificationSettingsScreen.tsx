import React, { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform, StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import {
  registerForPushNotificationsAsync,
  triggerLocalTestNotificationAsync,
  type NotificationDebugState,
} from "../../services/notificationService";
import { userFacingApiError } from "../../utils/userFacingApiError";
import { UX } from "../../utils/uxCopy";
import { theme } from "../../constants/theme";

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statusRow}>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={styles.statusValue}>{value}</Text>
    </View>
  );
}

function permissionLabel(status: NotificationDebugState["permissionStatus"]) {
  if (status === "granted") return "Granted";
  if (status === "denied") return "Denied";
  return "Not set";
}

function tokenLabel(token?: string | null) {
  if (!token) return "Not registered";
  return `${token.slice(0, 14)}…`;
}

function deviceLabel(isDevice?: boolean) {
  return isDevice ? "Physical device" : "This device";
}

export default function MobileNotificationSettingsScreen() {
  const [state, setState] = useState<NotificationDebugState | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setState(await registerForPushNotificationsAsync());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onTestPush = async () => {
    setSending(true);
    try {
      await triggerLocalTestNotificationAsync();
      Alert.alert("Notification sent", UX.notificationSent);
    } catch (e) {
      Alert.alert("Notifications", userFacingApiError(e));
    } finally {
      setSending(false);
    }
  };

  const openSettings = () => {
    if (Platform.OS === "ios") {
      void Linking.openURL("app-settings:");
    } else {
      void Linking.openSettings();
    }
  };

  return (
    <ProfileScreenLayout title="Mobile" subtitle="Device notification settings">
      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Device status</Text>
        {loading ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : (
          <>
            <StatusRow label="Device registration" value={tokenLabel(state?.expoPushToken)} />
            <StatusRow label="Permissions" value={permissionLabel(state?.permissionStatus ?? "unknown")} />
            <StatusRow label="Device" value={deviceLabel(state?.isDevice)} />
          </>
        )}
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Upcoming booking reminder</Text>
        <View style={styles.preview}>
          <Text style={styles.previewTitle}>Appointment reminder</Text>
          <Text style={styles.previewBody}>
            Your IFCDC appointment is tomorrow at 2:00 PM with Fade Master.
          </Text>
          <Text style={styles.sampleMeta}>Sample message</Text>
        </View>
      </ProfileCard>

      <GlowButton label="Refresh status" variant="outline" onPress={refresh} disabled={loading} />
      <View style={{ height: 10 }} />
      <GlowButton
        label={sending ? "Sending…" : "Send sample notification"}
        onPress={onTestPush}
        disabled={sending || loading}
        loading={sending}
      />
      <View style={{ height: 10 }} />
      <GlowButton label="Open device settings" variant="outline" onPress={openSettings} />
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 8 },
  section: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  statusLabel: { color: theme.colors.textMuted, fontSize: 14, flex: 1 },
  statusValue: { color: theme.colors.text, fontSize: 13, fontWeight: "600", maxWidth: "52%", textAlign: "right" },
  preview: {
    padding: 14,
    borderRadius: theme.radius.sm,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
    gap: 6,
  },
  previewTitle: { color: theme.colors.text, fontSize: 15, fontWeight: "700" },
  previewBody: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  previewMeta: { color: theme.colors.gold, fontSize: 11, fontWeight: "600", marginTop: 4 },
  sampleMeta: { color: theme.colors.textMuted, fontSize: 11, fontWeight: "600", marginTop: 4 },
  muted: { color: theme.colors.textMuted, fontSize: 14 },
});
