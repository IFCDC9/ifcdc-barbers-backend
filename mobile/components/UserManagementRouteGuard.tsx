import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/authContext";
import { canAccessUserManagement } from "../utils/userManagementAccess";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
  deniedMessage?: string;
};

/** User management — super admin or shop owner only. */
export default function UserManagementRouteGuard({
  children,
  deniedMessage = "User management is restricted to platform and shop admins.",
}: Props) {
  const { user, token, loading } = useAuth();
  const navigation = useNavigation();
  const allowed = canAccessUserManagement(user, token);

  React.useEffect(() => {
    if (!loading && !allowed) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [allowed, loading, navigation]);

  if (loading) return <View style={styles.blocked} />;

  if (!allowed) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.denied}>{deniedMessage}</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  blocked: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  denied: { color: theme.colors.textMuted, fontSize: 15, textAlign: "center" },
});
