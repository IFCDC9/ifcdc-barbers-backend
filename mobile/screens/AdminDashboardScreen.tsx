import React from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import GlowButton from "../components/GlowButton";
import { theme } from "../constants/theme";
import { useAuth } from "../services/authContext";

type Nav = {
  navigate: (name: string, params?: { screen?: string }) => void;
};

export default function AdminDashboardScreen({ navigation }: { navigation: Nav }) {
  const { signOut, user } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Admin Dashboard</Text>
      <Text style={styles.sub}>IFCDC platform owner</Text>
      {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <Text style={styles.cardCopy}>
          Use the main app tabs for booking and appointments. Admin bookings appear under Appointments
          when signed in as platform owner.
        </Text>
      </View>

      <GlowButton label="Open app (Home)" onPress={() => navigation.navigate("App")} />
      <View style={{ height: 12 }} />
      <GlowButton
        label="View Appointments"
        variant="outline"
        onPress={() => navigation.navigate("App", { screen: "Appointments" })}
      />
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
  },
  title: { color: theme.colors.gold, fontWeight: "900", fontSize: 22, textAlign: "center" },
  sub: { color: theme.colors.textMuted, marginTop: 8, fontSize: 14, textAlign: "center" },
  email: { color: theme.colors.text, marginTop: 6, fontSize: 13, textAlign: "center" },
  card: {
    marginVertical: 24,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: theme.colors.borderGold,
  },
  cardTitle: { color: theme.colors.gold, fontWeight: "800", fontSize: 14, marginBottom: 8 },
  cardCopy: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
});
