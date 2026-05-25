import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/authContext";
import { canManageServiceMenu } from "../utils/serviceManagementAccess";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
};

/** Service menu management — super_admin, admin, shop_owner, barber only.
 *  Customers are bounced back. Backend enforces per-barber scope on every call. */
export default function ServiceManagementGuard({ children }: Props) {
  const { user, token, loading } = useAuth();
  const navigation = useNavigation();

  const allowed = canManageServiceMenu(user, token);

  React.useEffect(() => {
    if (!loading && !allowed) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [allowed, loading, navigation]);

  if (loading) return <View style={styles.blocked} />;

  if (!allowed) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.denied}>
          Service management is available to barbers, shop owners, and platform admins.
        </Text>
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
  denied: {
    color: theme.colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
