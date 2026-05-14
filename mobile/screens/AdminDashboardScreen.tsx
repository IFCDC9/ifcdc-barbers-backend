import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import GlowButton from "../components/GlowButton";
import { theme } from "../constants/theme";
import { useAuth } from "../services/authContext";

export default function AdminDashboardScreen({ navigation }: { navigation: { navigate: (name: string) => void } }) {
  const { signOut } = useAuth();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.sub}>IFCDC platform owner</Text>
      <View style={{ height: 24 }} />
      <GlowButton label="Open main app" onPress={() => navigation.navigate("App")} variant="outline" />
      <View style={{ height: 12 }} />
      <GlowButton
        label="Sign out"
        variant="outline"
        onPress={async () => {
          await signOut();
          Alert.alert("Signed out", "You have been signed out.");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg0,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { color: theme.colors.gold, fontWeight: "900", fontSize: 22 },
  sub: { color: theme.colors.textMuted, marginTop: 8, fontSize: 14 },
});
