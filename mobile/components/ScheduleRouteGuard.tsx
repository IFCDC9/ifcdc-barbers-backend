import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/authContext";
import { canManageSchedules } from "../utils/scheduleAccess";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
};

/** Blocks schedule UI for customers; staff only. */
export default function ScheduleRouteGuard({ children }: Props) {
  const { user, token, loading } = useAuth();
  const navigation = useNavigation();

  const allowed = canManageSchedules(user, token);

  React.useEffect(() => {
    if (!loading && !allowed) {
      const parent = navigation.getParent();
      if (parent && "navigate" in parent) {
        (parent as { navigate: (name: string) => void }).navigate("Home");
      } else if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [allowed, loading, navigation]);

  if (loading) {
    return <View style={styles.blocked} />;
  }

  if (!allowed) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.denied}>Schedule controls are for staff only.</Text>
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
