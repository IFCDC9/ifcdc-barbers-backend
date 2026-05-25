import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import { ToggleRow } from "./AdminNotificationsScreen";
import {
  loadPlatformNotificationPrefs,
  savePlatformNotificationPrefs,
  type PlatformNotificationPrefs,
} from "../../services/adminPlatformNotificationPrefs";
import { triggerLocalTestNotificationAsync } from "../../services/notificationService";
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

export default function PlatformNotificationsScreen() {
  const [prefs, setPrefs] = useState<PlatformNotificationPrefs | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setPrefs(await loadPlatformNotificationPrefs());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const update = async (next: PlatformNotificationPrefs) => {
    setPrefs(next);
    await savePlatformNotificationPrefs(next);
  };

  const onTest = async () => {
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

  if (!prefs) return null;

  return (
    <ProfileScreenLayout title="Platform notifications" subtitle="Business-wide alert controls">
      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Channels</Text>
        <ToggleRow
          label="Push notifications"
          description="Send push alerts to customers and staff."
          value={prefs.pushEnabled}
          onValueChange={(v) => update({ ...prefs, pushEnabled: v })}
        />
        <ToggleRow
          label="SMS broadcast"
          description="Mass text alerts for promotions and updates."
          value={prefs.smsBroadcastEnabled}
          onValueChange={(v) => update({ ...prefs, smsBroadcastEnabled: v })}
        />
        <ToggleRow
          label="Email campaign"
          description="Marketing and announcement emails."
          value={prefs.emailCampaignEnabled}
          onValueChange={(v) => update({ ...prefs, emailCampaignEnabled: v })}
        />
        <ToggleRow
          label="Booking reminder"
          description="Automated reminders before appointments."
          value={prefs.bookingReminderEnabled}
          onValueChange={(v) => update({ ...prefs, bookingReminderEnabled: v })}
        />
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Delivery status</Text>
        <StatusRow label="Push" value="Ready" />
        <StatusRow label="SMS" value="Active" />
        <StatusRow label="Email" value="Active" />
      </ProfileCard>

      <GlowButton
        label={sending ? "Sending…" : "Send sample notification"}
        onPress={onTest}
        disabled={sending}
        loading={sending}
      />
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 2 },
  section: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  statusLabel: { color: theme.colors.textMuted, fontSize: 14 },
  statusValue: { color: theme.colors.gold, fontSize: 14, fontWeight: "700" },
});
