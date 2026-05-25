import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import NotificationMenuCard from "../../components/NotificationMenuCard";
import { theme } from "../../constants/theme";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";

export type NotificationAdminNavParams = {
  PlatformNotifications: undefined;
  MobileNotificationSettings: undefined;
};

export default function AdminNotificationsScreen() {
  const navigation = useNavigation<StackNavigationProp<NotificationAdminNavParams>>();

  return (
    <ProfileScreenLayout
      title="Notification controls"
      subtitle="Manage platform and mobile alerts"
      headerTopPad={12}
    >
      <View style={styles.list}>
        <NotificationMenuCard
          icon="📡"
          title="Platform notifications"
          subtitle="Broadcasts, campaigns, and booking reminders"
          onPress={() => navigation.navigate("PlatformNotifications")}
        />
        <NotificationMenuCard
          icon="📱"
          title="Mobile"
          subtitle="Device permissions and sample alerts"
          onPress={() => navigation.navigate("MobileNotificationSettings")}
        />
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingTop: 4 },
});

export function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={toggleStyles.row}>
      <View style={toggleStyles.copy}>
        <Text style={toggleStyles.label}>{label}</Text>
        {description ? <Text style={toggleStyles.desc}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#333", true: "rgba(245,200,66,0.45)" }}
        thumbColor={value ? theme.colors.gold : "#888"}
      />
    </View>
  );
}

const toggleStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  copy: { flex: 1, paddingRight: 12 },
  label: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  desc: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 4 },
});
