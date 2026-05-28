import React from "react";
import { StyleSheet, Text } from "react-native";
import ProfileScreenLayout from "../../components/ProfileScreenLayout";
import ProfileCard from "../../components/ProfileCard";
import { useAuth } from "../../services/authContext";
import { AdminMenuList } from "./adminMenu";
import { UX } from "../../utils/uxCopy";
import { palette, typography } from "../../constants/theme";

type Nav = { navigate: (name: string) => void };

export default function AdminHomeScreen({ navigation }: { navigation: Nav }) {
  const { user } = useAuth();

  return (
    <ProfileScreenLayout title="Admin" subtitle={UX.adminTools} standalone>
      <ProfileCard glow style={styles.hero}>
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
  heroTitle: { ...typography.title, color: palette.gold, fontSize: 20 },
  heroEmail: { ...typography.caption },
  heroCopy: { ...typography.bodyMuted, textAlign: "center", marginTop: 4 },
});
