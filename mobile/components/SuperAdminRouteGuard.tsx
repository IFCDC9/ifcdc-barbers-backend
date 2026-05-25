import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/authContext";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
};

/** User management and related tools — super admins only. */
export default function SuperAdminRouteGuard({ children }: Props) {
  const { isPlatformAdmin, loading } = useAuth();
  const navigation = useNavigation();

  React.useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      if (navigation.canGoBack()) navigation.goBack();
    }
  }, [isPlatformAdmin, loading, navigation]);

  if (loading) return <View style={styles.blocked} />;

  if (!isPlatformAdmin) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.denied}>This area is restricted to platform administrators.</Text>
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
