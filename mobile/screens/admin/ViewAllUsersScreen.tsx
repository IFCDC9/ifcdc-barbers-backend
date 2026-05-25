import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import UserRosterCard from "../../components/UserRosterCard";
import GlowButton from "../../components/GlowButton";
import UserManagementRouteGuard from "../../components/UserManagementRouteGuard";
import { fetchAdminUsers, type AdminUserRow } from "../../services/adminUsersApi";
import { useAuth } from "../../services/authContext";
import { isSuperAdminUser } from "../../utils/adminAccess";
import { canViewUser } from "../../utils/userManagementAccess";
import { useNavigation } from "@react-navigation/native";
import type { StackNavigationProp } from "@react-navigation/stack";
import type { AdminStackParamList } from "../../navigation/AdminStack";
import { theme } from "../../constants/theme";

type Nav = StackNavigationProp<AdminStackParamList, "ViewAllUsers">;

function ViewAllUsersInner() {
  const navigation = useNavigation<Nav>();
  const { user, token } = useAuth();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchAdminUsers();
      const visible = isSuperAdminUser(user, token)
        ? rows
        : rows.filter((row) => canViewUser(user, token, row));
      setUsers(visible);
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ProfileScreenLayout title="View All Users" subtitle="Platform users" headerTopPad={12}>
      {loading ? (
        <ActivityIndicator color={theme.colors.gold} style={styles.loader} />
      ) : (
        <>
          <Text style={styles.count}>{users.length} platform users</Text>
          <View style={styles.list}>
            {users.map((user) => (
              <UserRosterCard
                key={user.id}
                user={user}
                onPress={() => navigation.navigate("UserDetail", { userId: user.id })}
              />
            ))}
          </View>
          <GlowButton label="Refresh list" variant="outline" onPress={load} disabled={loading} />
        </>
      )}
    </ProfileScreenLayout>
  );
}

export default function ViewAllUsersScreen() {
  return (
    <UserManagementRouteGuard>
      <ViewAllUsersInner />
    </UserManagementRouteGuard>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: 32, marginBottom: 8 },
  count: {
    color: theme.colors.gold,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  list: { gap: 10, marginBottom: 12 },
});
