import React from "react";
import { StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import NotificationMenuCard from "../../components/NotificationMenuCard";
import { useAuth } from "../../services/authContext";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AdminStackParamList } from "../../navigation/AdminStack";
import { roleLabel } from "../../utils/roleManagementPolicy";
import { theme } from "../../constants/theme";

type Nav = StackNavigationProp<AdminStackParamList, "AdminUsers">;

type UserMgmtRoute =
  | "ViewAllUsers"
  | "ManageRolesScreen"
  | "InviteUserScreen"
  | "AdminAccessAuditScreen"
  | "ResetUserPasswordScreen";

const USER_ACTIONS: {
  icon: string;
  title: string;
  subtitle: string;
  route: UserMgmtRoute;
}[] = [
  {
    icon: "👥",
    title: "View All Users",
    subtitle: "Browse every account on the platform",
    route: "ViewAllUsers",
  },
  {
    icon: "🛡️",
    title: "Manage Roles",
    subtitle: "Assign barber, owner, and admin roles",
    route: "ManageRolesScreen",
  },
  {
    icon: "✉️",
    title: "Invite User",
    subtitle: "Send invites to new staff or customers",
    route: "InviteUserScreen",
  },
  {
    icon: "📋",
    title: "Admin Access Audit",
    subtitle: "Review who has elevated platform access",
    route: "AdminAccessAuditScreen",
  },
  {
    icon: "🔑",
    title: "Reset User Password",
    subtitle: "Trigger a secure password reset for an account",
    route: "ResetUserPasswordScreen",
  },
];

export default function AdminUsersScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();

  return (
    <ProfileScreenLayout title="User management" subtitle="Platform users">
      <ProfileCard>
        <Text style={styles.sessionTitle}>Current session</Text>
        <Text style={styles.row}>Email: {user?.email || "—"}</Text>
        <Text style={styles.row}>
          Role: {user?.role ? roleLabel(user.role) : "—"}
        </Text>
        <Text style={styles.row}>
          Access level: {user?.isSuperAdmin ? "Platform admin" : "Standard"}
        </Text>
      </ProfileCard>

      <View style={styles.list}>
        {USER_ACTIONS.map((action) => (
          <NotificationMenuCard
            key={action.title}
            icon={action.icon}
            title={action.title}
            subtitle={action.subtitle}
            onPress={() => navigation.navigate(action.route)}
          />
        ))}
      </View>
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  sessionTitle: { color: theme.colors.gold, fontWeight: "800", fontSize: 15, marginBottom: 8 },
  row: { color: theme.colors.textMuted, fontSize: 14, marginBottom: 4 },
  list: { gap: 12, paddingTop: 4 },
});
