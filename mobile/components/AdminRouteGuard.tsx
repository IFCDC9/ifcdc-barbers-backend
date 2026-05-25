import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../services/authContext";
import { theme } from "../constants/theme";

type Props = {
  children: React.ReactNode;
};

/** Blocks admin UI for non–super-admin sessions (client-side guard; APIs remain JWT-protected). */
export default function AdminRouteGuard({ children }: Props) {
  const { isPlatformAdmin, loading } = useAuth();
  const navigation = useNavigation();

  React.useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      const parent = navigation.getParent();
      if (parent && "navigate" in parent) {
        (parent as { navigate: (name: string) => void }).navigate("Home");
      }
    }
  }, [isPlatformAdmin, loading, navigation]);

  if (loading) {
    return <View style={styles.blocked} />;
  }

  if (!isPlatformAdmin) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.denied}>Access denied</Text>
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
  },
  denied: { color: theme.colors.textMuted, fontSize: 15 },
});
