import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import GlowButton from "../../components/GlowButton";
import {
  registerForPushNotificationsAsync,
  triggerLocalTestNotificationAsync,
  type NotificationDebugState,
} from "../../services/notificationService";
import {
  fetchServerPreferences,
  saveServerPreferences,
  registerPushToken,
  sendServerTestPush,
  DEFAULT_SERVER_PREFS,
  type ServerNotificationPreferences,
} from "../../services/pushApi";
import { theme } from "../../constants/theme";
import { userFacingApiError } from "../../utils/userFacingApiError";

function PrefRow({
  label,
  description,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, disabled && styles.rowLabelDisabled]}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: "#333", true: "rgba(245,200,66,0.45)" }}
        thumbColor={value ? theme.colors.gold : "#888"}
      />
    </View>
  );
}

function permissionLabel(state: NotificationDebugState | null): string {
  if (!state) return "Checking…";
  if (!state.isDevice) return "Simulator (push not available)";
  switch (state.permissionStatus) {
    case "granted":
      return "Allowed";
    case "denied":
      return state.canAskAgain ? "Denied — tap to retry" : "Blocked in system settings";
    case "undetermined":
      return "Not asked yet";
    default:
      return "Unknown";
  }
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState<ServerNotificationPreferences>(DEFAULT_SERVER_PREFS);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pushState, setPushState] = useState<NotificationDebugState | null>(null);
  const [testing, setTesting] = useState(false);
  const initialLoad = useRef(true);

  const refreshPushStatus = useCallback(async () => {
    try {
      const state = await registerForPushNotificationsAsync();
      setPushState(state);
      if (state.expoPushToken) {
        // Re-register quietly each time the screen re-checks permission.
        await registerPushToken(state.expoPushToken);
      }
    } catch (e) {
      setPushState({
        platform: Platform.OS,
        isDevice: false,
        permissionStatus: "unknown",
        error: userFacingApiError(e, "Unable to read notification status."),
      });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [server] = await Promise.all([fetchServerPreferences(), refreshPushStatus()]);
      setPrefs(server);
    } finally {
      setLoading(false);
      initialLoad.current = false;
    }
  }, [refreshPushStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<ServerNotificationPreferences>) => {
      const next: ServerNotificationPreferences = { ...prefs, ...patch };
      setPrefs(next);
      try {
        const result = await saveServerPreferences(patch);
        setPrefs(result);
      } catch {
        // Silent — don't surface raw errors. Local state already reflects the toggle.
      }
    },
    [prefs],
  );

  const onTestPress = useCallback(async () => {
    setTesting(true);
    try {
      // 1. Local fallback so the user sees something even without backend access.
      await triggerLocalTestNotificationAsync().catch(() => undefined);
      // 2. Server-side push via Expo for end-to-end verification.
      const result = await sendServerTestPush();
      Alert.alert(
        "Test notification",
        result.sent > 0
          ? `Test notification sent to ${result.sent} device(s).`
          : result.message,
      );
    } catch (e) {
      Alert.alert(
        "Test notification",
        userFacingApiError(e, "Test notification could not be sent right now."),
      );
    } finally {
      setTesting(false);
    }
  }, []);

  const onRequestPermission = useCallback(async () => {
    setBusy(true);
    try {
      await refreshPushStatus();
    } finally {
      setBusy(false);
    }
  }, [refreshPushStatus]);

  const openSystemSettings = useCallback(() => {
    void Linking.openSettings().catch(() => {
      Alert.alert(
        "Notifications",
        "Open the Settings app and enable IFCDC Barbers notifications to start receiving alerts.",
      );
    });
  }, []);

  if (loading && initialLoad.current) {
    return (
      <ProfileScreenLayout title="Notifications" subtitle="Manage how we reach you">
        <View style={{ paddingVertical: 32, alignItems: "center" }}>
          <ActivityIndicator color={theme.colors.gold} />
        </View>
      </ProfileScreenLayout>
    );
  }

  const blocked =
    pushState?.permissionStatus === "denied" && pushState?.canAskAgain === false;
  const granted = pushState?.permissionStatus === "granted";
  const pushDisabled = !granted || prefs.push_enabled === false;

  return (
    <ProfileScreenLayout title="Notifications" subtitle="Manage how we reach you">
      <ProfileCard style={styles.card}>
        <Text style={styles.section}>{t("notifications.emailTitle")}</Text>
        <Text style={styles.emailNote}>{t("notifications.emailBody")}</Text>
      </ProfileCard>
      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Push notifications</Text>
        <View style={styles.statusRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.statusLabel}>Device permission</Text>
            <Text style={styles.statusValue}>{permissionLabel(pushState)}</Text>
          </View>
        </View>
        {pushState?.error ? (
          <Text style={styles.errorCopy}>{pushState.error}</Text>
        ) : null}

        <PrefRow
          label="Allow push notifications"
          description="Master toggle for all push alerts to this account."
          value={!!prefs.push_enabled && granted}
          onValueChange={(v) => update({ push_enabled: v })}
          disabled={!granted}
        />

        {!granted ? (
          <View style={styles.permissionActions}>
            {blocked ? (
              <GlowButton
                label="Open device settings"
                variant="outline"
                onPress={openSystemSettings}
                disabled={busy}
              />
            ) : (
              <GlowButton
                label={busy ? "Asking…" : "Enable on this device"}
                onPress={() => void onRequestPermission()}
                disabled={busy}
                loading={busy}
              />
            )}
          </View>
        ) : null}

        <View style={styles.testActions}>
          <GlowButton
            label={testing ? "Sending…" : "Send test notification"}
            variant="outline"
            onPress={() => void onTestPress()}
            disabled={testing}
            loading={testing}
          />
        </View>
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Booking alerts</Text>
        <PrefRow
          label="Booking confirmations"
          description="Sent when a new appointment is confirmed."
          value={!!prefs.booking_confirmations}
          onValueChange={(v) => update({ booking_confirmations: v })}
          disabled={pushDisabled}
        />
        <PrefRow
          label="Appointment reminders"
          description="Reminders before each scheduled appointment."
          value={!!prefs.reminders}
          onValueChange={(v) => update({ reminders: v })}
          disabled={pushDisabled}
        />
        <PrefRow
          label="Cancellations"
          description="Alerts when an appointment is cancelled."
          value={!!prefs.cancellations}
          onValueChange={(v) => update({ cancellations: v })}
          disabled={pushDisabled}
        />
        <PrefRow
          label="Reschedules"
          description="Alerts when an appointment moves to a new time."
          value={!!prefs.reschedules}
          onValueChange={(v) => update({ reschedules: v })}
          disabled={pushDisabled}
        />
        <PrefRow
          label="Appointment updates"
          description="Other status changes (checked in, completed, no-show)."
          value={!!prefs.status_updates}
          onValueChange={(v) => update({ status_updates: v })}
          disabled={pushDisabled}
        />
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Platform</Text>
        <PrefRow
          label="Admin alerts"
          description="Operational alerts for staff and platform admins."
          value={!!prefs.admin_alerts}
          onValueChange={(v) => update({ admin_alerts: v })}
          disabled={pushDisabled}
        />
        <PrefRow
          label="Marketing & promotions"
          description="Off by default. Special offers and product updates."
          value={!!prefs.marketing}
          onValueChange={(v) => update({ marketing: v })}
          disabled={pushDisabled}
        />
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <Text style={styles.section}>Email</Text>
        <PrefRow
          label="Booking confirmations"
          description="Receive an email when an appointment is confirmed."
          value={!!prefs.email_booking_confirmations}
          onValueChange={(v) => update({ email_booking_confirmations: v })}
        />
        <PrefRow
          label="Appointment reminders"
          description="Reminder emails before your visit."
          value={!!prefs.email_reminders}
          onValueChange={(v) => update({ email_reminders: v })}
        />
      </ProfileCard>

      <ProfileCard style={styles.card}>
        <Text style={styles.section}>SMS</Text>
        <PrefRow
          label="SMS notifications"
          description="SMS alerts are currently paused. Email and push remain active."
          value={false}
          onValueChange={() => {}}
          disabled
        />
      </ProfileCard>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  section: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  emailNote: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  statusLabel: {
    color: theme.colors.textMuted,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontWeight: "700",
  },
  statusValue: {
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 2,
  },
  errorCopy: {
    color: "#ff8a80",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 4,
  },
  permissionActions: { marginTop: 8 },
  testActions: { marginTop: 12 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  rowLabelDisabled: { color: theme.colors.textMuted },
  rowDesc: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
});
