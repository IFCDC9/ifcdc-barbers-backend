import React, { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { BACKEND_URL, apiFullUrl } from "../../constants/config";
import { reportConnectionFailure } from "../../services/connectionAlerts";
import {
  registerForPushNotificationsAsync,
  triggerLocalTestNotificationAsync,
} from "../../services/notificationService";
import { useAuth } from "../../services/authContext";
import BackendHealthCard from "../../components/BackendHealthCard";
import CardContainer from "../../components/CardContainer";
import GlowButton from "../../components/GlowButton";
import { theme } from "../../constants/theme";

const ProfileScreen = () => {
  const { signOut } = useAuth();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [perm, setPerm] = useState<string>("unknown");

  const register = async () => {
    const state = await registerForPushNotificationsAsync();
    console.log("[notif] permission:", state.permissionStatus, "canAskAgain:", state.canAskAgain);
    console.log("[notif] token:", state.expoPushToken, "error:", state.error);
    console.log("[notif] isDevice:", state.isDevice, "platform:", state.platform);
    setPerm(String(state.permissionStatus));
    setPushToken(state.expoPushToken || null);

    if (state.error) {
      Alert.alert("Notifications", state.error);
      return;
    }
    if (state.permissionStatus !== "granted") {
      Alert.alert("Notifications", "Permission not granted.");
      return;
    }
    Alert.alert("Notifications", state.expoPushToken ? "Push token acquired." : "Permission OK, but no push token.");
  };

  const sendToBackend = async () => {
    if (!pushToken) {
      Alert.alert("Push token missing", "Tap Register first.");
      return;
    }
    try {
      const res = await fetch(apiFullUrl("/api/push/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: pushToken }),
      });
      const json = await res.json();
      Alert.alert("Backend", JSON.stringify(json));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log("[profile] push register failed:", msg);
      reportConnectionFailure({
        kind: "network",
        url: apiFullUrl("/api/push/register"),
        message: msg,
      });
      Alert.alert("Backend", msg);
    }
  };

  const localTest = async () => {
    await triggerLocalTestNotificationAsync();
    Alert.alert("Local notification", "Scheduled (1s).");
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>

      <CardContainer glow style={{ width: "100%" }}>
        <Text style={styles.cardTitle}>Connectivity</Text>
        <BackendHealthCard />
      </CardContainer>

      <CardContainer glow style={{ width: "100%" }}>
        <GlowButton
          label="Sign out"
          onPress={async () => {
            await signOut();
            Alert.alert("Signed out", "You’ve been signed out.");
          }}
          variant="outline"
        />
      </CardContainer>

      <CardContainer glow style={{ width: "100%" }}>
        <Text style={styles.meta}>Permission: {perm}</Text>
        <Text style={styles.meta} numberOfLines={2}>
          Token: {pushToken || "—"}
        </Text>

        <View style={{ height: 12 }} />
        <GlowButton label="Register for notifications" onPress={register} />
        <View style={{ height: 10 }} />
        <GlowButton label="Trigger local notification" onPress={localTest} variant="outline" />
        <View style={{ height: 10 }} />
        <GlowButton label="Send token to backend" onPress={sendToBackend} variant="outline" />
      </CardContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: theme.colors.bg0,
    padding: 20,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: theme.colors.text,
    marginBottom: 8,
  },
  meta: { color: theme.colors.textMuted, textAlign: "center" },
  cardTitle: { color: theme.colors.gold, fontWeight: "800", marginBottom: 8, fontSize: 13 },
});

export default ProfileScreen;