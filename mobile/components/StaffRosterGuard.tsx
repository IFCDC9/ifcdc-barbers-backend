import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/authContext";
import { canManageSchedules } from "../utils/scheduleAccess";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
};

/** Staff roster — super admin, shop owner, barber only (not customers). */
export default function StaffRosterGuard({ children }: Props) {
  const { user, token, loading } = useAuth();
  const navigation = useNavigation();

  const allowed = canManageSchedules(user, token);

  React.useEffect(() => {
    if (!loading && !allowed) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [allowed, loading, navigation]);

  if (loading) return <View style={styles.blocked} />;

  if (!allowed) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.denied}>Barber roster is for staff only.</Text>
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
