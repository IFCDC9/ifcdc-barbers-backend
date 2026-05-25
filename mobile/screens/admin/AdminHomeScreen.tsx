import React from "react";
import { StyleSheet, Text } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import { useAuth } from "../../services/authContext";
import { AdminMenuList } from "./adminMenu";
import { UX } from "../../utils/uxCopy";
import { theme } from "../../constants/theme";

type Nav = { navigate: (name: string) => void };

export default function AdminHomeScreen({ navigation }: { navigation: Nav }) {
  const { user } = useAuth();

  return (
    <ProfileScreenLayout title="Admin" subtitle={UX.adminTools} standalone>
      <ProfileCard style={styles.hero}>
        <Text style={styles.heroTitle}>Platform Admin</Text>
        {user?.email ? <Text style={styles.heroEmail}>{user.email}</Text> : null}
        <Text style={styles.heroCopy}>
          Manage bookings, barbers, payouts, and platform settings from one place.
        </Text>
      </ProfileCard>
      <AdminMenuList navigation={navigation} />
    </ProfileScreenLayout>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", marginBottom: 8, gap: 6 },
  heroTitle: { color: theme.colors.gold, fontSize: 20, fontWeight: "800" },
  heroEmail: { color: theme.colors.textMuted, fontSize: 13 },
  heroCopy: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center", marginTop: 4 },
});
